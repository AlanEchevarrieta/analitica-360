// Bloqueo por prueba/plan vencido de punta a punta (AppModule completo, guards reales).
// Necesita una base DESCARTABLE con las migraciones aplicadas; carga sus propios datos:
//   docker run -d --name pg-e2e -e POSTGRES_PASSWORD=e2e -p 5499:5432 postgres:16
//   DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec prisma migrate deploy
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts suscripcion
// Sin E2E_DATABASE_URL se saltea (nunca toca la base de desarrollo).
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const URL_E2E = process.env.E2E_DATABASE_URL;

// El token de prueba es "<clerkUserId>|<clerkOrgId>": se reemplaza solo la verificación de Clerk.
vi.mock('@clerk/backend', async (original) => ({
  ...(await original<typeof import('@clerk/backend')>()),
  verifyToken: async (token: string) => {
    const [sub, org] = token.split('|');
    return { sub, o: { id: org } };
  },
}));

const hoy = new Date().toISOString().slice(0, 10);
const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const EMPRESAS = {
  pruebaVencida: { estado: 'periodo_prueba', vence: dias(-1) },
  planVencido: { estado: 'activa', vence: dias(-20) },
  enGracia: { estado: 'activa', vence: dias(-3) },
  activa: { estado: 'activa', vence: dias(30) },
} as const;
type Clave = keyof typeof EMPRESAS;

describe.skipIf(!URL_E2E)('Suscripción vencida: solo lectura (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const ids = new Map<Clave, { empresaId: string; token: string }>();
  const auth = (c: Clave) => ({ Authorization: `Bearer ${ids.get(c)!.token}` });

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const planId = randomUUID();
    await db.query(`INSERT INTO planes (id, nombre) VALUES ($1, 'premium')`, [planId]);
    for (const [clave, s] of Object.entries(EMPRESAS) as [Clave, (typeof EMPRESAS)[Clave]][]) {
      const empresaId = randomUUID();
      const org = `org_${clave}_${empresaId.slice(0, 8)}`;
      const user = `user_${clave}_${empresaId.slice(0, 8)}`;
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresaId, `E2E ${clave}`, org]);
      await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueño', $3, $4, 'dueno')`, [randomUUID(), empresaId, `${clave}@e2e.test`, user]);
      await db.query(
        `INSERT INTO suscripciones (id, empresa_id, plan_id, estado, fecha_inicio, fecha_vencimiento) VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), empresaId, planId, s.estado, hoy, s.vence],
      );
      ids.set(clave, { empresaId, token: `${user}|${org}` });
    }

    const { AppModule } = await import('../src/app.module.js');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('GET /suscripcion informa el nivel de acceso de cada empresa', async () => {
    const nivel = async (c: Clave) => (await request(app.getHttpServer()).get('/suscripcion').set(auth(c)).expect(200)).body.acceso.nivel;
    expect(await nivel('pruebaVencida')).toBe('solo_lectura');
    expect(await nivel('planVencido')).toBe('solo_lectura');
    expect(await nivel('enGracia')).toBe('gracia');
    expect(await nivel('activa')).toBe('activo');
  });

  it('solo lectura: puede consultar pero no cargar', async () => {
    await request(app.getHttpServer()).get('/productos').set(auth('pruebaVencida')).expect(200);
    const res = await request(app.getHttpServer()).post('/clientes').set(auth('pruebaVencida')).send({ nombre: 'X' }).expect(403);
    expect(res.body.code).toBe('cuenta_solo_lectura');
  });

  it('activa o en gracia: la carga llega a la validación (no la frena el bloqueo)', async () => {
    for (const c of ['activa', 'enGracia'] as Clave[]) {
      const res = await request(app.getHttpServer()).post('/clientes').set(auth(c)).send({});
      expect(res.status).toBe(400);
    }
  });

  it('exportar: no con la prueba vencida, sí con el plan pago vencido', async () => {
    const res = await request(app.getHttpServer()).get('/import-export/exportar/productos').set(auth('pruebaVencida')).expect(403);
    expect(res.body.code).toBe('cuenta_sin_exportacion');
    await request(app.getHttpServer()).get('/import-export/exportar/productos').set(auth('planVencido')).expect(200);
  });

  it('Soporte funciona aunque la cuenta esté vencida', async () => {
    const res = await request(app.getHttpServer()).post('/tickets').set(auth('pruebaVencida')).send({});
    expect(res.status).toBe(400);
  });
});
