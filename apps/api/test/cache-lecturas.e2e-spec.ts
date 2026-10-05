// Cache de reportes de punta a punta: se guarda por empresa y cualquier
// escritura de la empresa la invalida (nunca se ve un dato viejo después de cargar algo).
//
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts cache
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { suscripcionActiva } from './e2e-helpers.js';

const URL_E2E = process.env.E2E_DATABASE_URL;

vi.mock('@clerk/backend', async (original) => ({
  ...(await original<typeof import('@clerk/backend')>()),
  verifyToken: async (token: string) => {
    const [sub, org] = token.split('|');
    return { sub, o: org ? { id: org } : undefined };
  },
}));

describe.skipIf(!URL_E2E)('Cache de reportes (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const otra = randomUUID();
  const usuario = randomUUID();
  const DUENO = { Authorization: `Bearer user_cache_${sufijo}|org_cache_${sufijo}` };
  const OTRA = { Authorization: `Bearer user_cache2_${sufijo}|org_cache2_${sufijo}` };
  const venta = () =>
    db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, forma_pago, fecha, total_sin_interes, total_con_interes) VALUES ($1, $2, $3, 'efectivo', now(), 1000, 1000)`, [randomUUID(), empresa, usuario]);

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    process.env.CACHE_LECTURAS = '1';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    for (const [id, k, u] of [
      [empresa, 'cache', usuario],
      [otra, 'cache2', randomUUID()],
    ]) {
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [id, `Cache ${k} ${sufijo}`, `org_${k}_${sufijo}`]);
      await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueño', $3, $4, 'dueno')`, [u, id, `${k}_${sufijo}@e2e.test`, `user_${k}_${sufijo}`]);
      await suscripcionActiva(db, id);
    }
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    delete process.env.CACHE_LECTURAS;
    await app?.close();
    await db?.end();
  });

  const hoy = async (h = DUENO) => (await request(app.getHttpServer()).get('/analytics/dashboard').set(h).expect(200)).body.hoy.cantidad as number;

  it('se guarda: un cambio hecho por fuera de la app no se ve hasta que la empresa escribe algo', async () => {
    expect(await hoy()).toBe(0);
    await venta();
    expect(await hoy()).toBe(0);
    await request(app.getHttpServer()).patch('/configuracion').set(DUENO).send({}).expect(200);
    expect(await hoy()).toBe(1);
  });

  it('la escritura de otra empresa no invalida la de esta', async () => {
    await venta();
    await request(app.getHttpServer()).patch('/configuracion').set(OTRA).send({}).expect(200);
    expect(await hoy()).toBe(1);
    await request(app.getHttpServer()).patch('/configuracion').set(DUENO).send({}).expect(200);
    expect(await hoy()).toBe(2);
  });

  it('cada empresa ve lo suyo aunque la ruta sea la misma', async () => {
    expect(await hoy(OTRA)).toBe(0);
    expect(await hoy()).toBe(2);
  });
});
