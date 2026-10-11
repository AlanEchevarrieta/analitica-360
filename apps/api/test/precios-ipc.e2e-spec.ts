// Aumentos de precio por IPC de punta a punta (AppModule completo, guards reales):
// la consola programa un aumento → sale el aviso por email a los dueños → el
// cobro usa el precio nuevo solo para los períodos que empiezan desde esa fecha.
// También: 30 días mínimos de aviso, fecha repetida, cancelar, 403 para no admin
// y la ruta pública de la landing.
//
// Usa una fecha lejana (2090) para no cruzarse con las otras pruebas que corren
// en paralelo sobre la misma base, y borra lo que crea al terminar.
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts precios-ipc
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

const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const dias = (n: number) => new Date(Date.parse(`${hoy}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const sufijo = randomUUID().slice(0, 8);
const FECHA = '2090-01-01';

describe.skipIf(!URL_E2E)('Precios: aumento por IPC con aviso de 30 días (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const emails: { to: string[]; subject: string; text: string }[] = [];
  const bearer = (user: string, org = '') => ({ Authorization: `Bearer ${user}|${org}` });
  const ADMIN = bearer(`user_admin_${sufijo}`, `org_admin_${sufijo}`);
  const CLIENTE = bearer(`user_cli_${sufijo}`, `org_cli_${sufijo}`);
  const clienteId = randomUUID();
  const emailCliente = `dueno_${sufijo}@e2e.test`;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    process.env.RESEND_API_KEY = 're_e2e';
    const original = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).startsWith('https://api.resend.com/')) {
        emails.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ id: 'e2e' }), { status: 200 });
      }
      if (String(url).includes('api.bcra.gob.ar')) return new Response('{}', { status: 503 });
      return original(url, init);
    });
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    await db.query(`DELETE FROM precios_plan WHERE vigente_desde = $1`, [FECHA]);
    for (const nombre of ['basico', 'pro', 'ecommerce']) {
      await db.query(`INSERT INTO planes (id, nombre) SELECT gen_random_uuid(), $1 WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = $1)`, [nombre]);
    }
    const adminEmpresa = randomUUID();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, 'Analítica 360 E2E', $2)`, [adminEmpresa, `org_admin_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Admin', $3, $4, 'dueno')`, [randomUUID(), adminEmpresa, `admin_${sufijo}@e2e.test`, `user_admin_${sufijo}`]);
    await suscripcionActiva(db, adminEmpresa);
    await db.query(`INSERT INTO admin_emails (email) VALUES ($1)`, [`admin_${sufijo}@e2e.test`]);
    // Un cliente con plan Pro activo: tiene que recibir el aviso con su plan.
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [clienteId, `Cliente IPC ${sufijo}`, `org_cli_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueño', $3, $4, 'dueno')`, [randomUUID(), clienteId, emailCliente, `user_cli_${sufijo}`]);
    await suscripcionActiva(db, clienteId, 'pro');

    const { AppModule } = await import('../src/app.module.js');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await db?.query(`DELETE FROM precios_plan WHERE vigente_desde = $1`, [FECHA]).catch(() => {});
    await app?.close();
    await db?.end();
    vi.restoreAllMocks();
  });

  const api = () => request(app.getHttpServer());

  it('la landing ve los precios de hoy sin sesión', async () => {
    const r = await api().get('/planes/precios').expect(200);
    expect(r.body.precios).toEqual({ basico: 49_000, pro: 89_000, ecommerce: 149_000 });
  });

  it('un cliente no puede programar aumentos', async () => {
    await api().post('/admin/precios').set(CLIENTE).send({ vigenteDesde: FECHA, porcentaje: 10 }).expect(403);
  });

  it('no deja programar con menos de 30 días de aviso', async () => {
    const r = await api().post('/admin/precios').set(ADMIN).send({ vigenteDesde: dias(29), porcentaje: 10 }).expect(400);
    expect(r.body.message).toContain('30 días');
  });

  it('programa +10 % y avisa por email al dueño con su plan', async () => {
    const r = await api().post('/admin/precios').set(ADMIN).send({ vigenteDesde: FECHA, porcentaje: 10, motivo: 'IPC e2e' }).expect(201);
    const programados = r.body.programados.filter((p: { vigenteDesde: string }) => p.vigenteDesde === FECHA);
    expect(programados.map((p: { plan: string; precioMensual: number }) => [p.plan, p.precioMensual]).sort()).toEqual([
      ['basico', 53_900],
      ['ecommerce', 163_900],
      ['pro', 97_900],
    ]);
    expect(programados.every((p: { avisadoEl: string | null; rigeDesde: string }) => p.avisadoEl === hoy && p.rigeDesde === FECHA)).toBe(true);
    const aviso = emails.find((e) => e.to.includes(emailCliente));
    expect(aviso?.subject).toContain('1 de enero de 2090');
    expect(aviso?.text).toContain('Tu plan Pro pasa de $89.000 a $97.900 por mes.');
  });

  it('no deja programar dos veces la misma fecha', async () => {
    await api().post('/admin/precios').set(ADMIN).send({ vigenteDesde: FECHA, porcentaje: 5 }).expect(409);
  });

  it('el cobro usa el precio nuevo solo desde esa fecha (y el anual queda con el de cuando empieza)', async () => {
    const antes = await api().post('/admin/pagos/cotizar').set(ADMIN).send({ empresaId: clienteId, plan: 'pro', ciclo: 'mensual', desde: '2089-12-31' }).expect(200);
    expect(antes.body.monto).toBe(89_000);
    const despues = await api().post('/admin/pagos/cotizar').set(ADMIN).send({ empresaId: clienteId, plan: 'pro', ciclo: 'mensual', desde: FECHA }).expect(200);
    expect(despues.body.monto).toBe(97_900);
    // Anual que empieza el día antes: 12 × 89.000 − 25 %, congelado todo el año.
    const anual = await api().post('/admin/pagos/cotizar').set(ADMIN).send({ empresaId: clienteId, plan: 'pro', ciclo: 'anual', desde: '2089-12-31' }).expect(200);
    expect(anual.body.cotizacion.total).toBe(801_000);
    // Hoy la landing sigue con los precios actuales.
    const landing = await api().get('/planes/precios').expect(200);
    expect(landing.body.precios.pro).toBe(89_000);
  });

  it('se puede cancelar mientras no rige', async () => {
    const panel = await api().get('/admin/precios').set(ADMIN).expect(200);
    const ids = panel.body.programados.filter((p: { vigenteDesde: string }) => p.vigenteDesde === FECHA).map((p: { id: string }) => p.id);
    expect(ids).toHaveLength(3);
    for (const id of ids) await api().delete(`/admin/precios/${id}`).set(ADMIN).expect(200);
    const despues = await api().post('/admin/pagos/cotizar').set(ADMIN).send({ empresaId: clienteId, plan: 'pro', ciclo: 'mensual', desde: FECHA }).expect(200);
    expect(despues.body.monto).toBe(89_000);
  });
});
