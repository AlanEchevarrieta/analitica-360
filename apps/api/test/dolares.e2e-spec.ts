// Reportes en dólares de punta a punta: cada venta se pasa con la cotización de su día.
//
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts dolares
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

describe.skipIf(!URL_E2E)('Reportes en dólares (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const usuario = randomUUID();
  const DUENO = { Authorization: `Bearer user_usd_${sufijo}|org_usd_${sufijo}` };
  const s = () => app.getHttpServer();
  const RANGO = 'desde=2026-09-01&hasta=2026-09-03';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `USD ${sufijo}`, `org_usd_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueño', $3, $4, 'dueno')`, [usuario, empresa, `usd_${sufijo}@e2e.test`, `user_usd_${sufijo}`]);
    await suscripcionActiva(db, empresa);
    // Blue: 1000 el 01/09 (el 02/09 no hay: vale la del 01) y 2000 el 03/09. Oficial: sin datos.
    await db.query(`DELETE FROM cotizaciones_dolar WHERE casa IN ('blue', 'oficial')`);
    await db.query(`INSERT INTO cotizaciones_dolar (casa, fecha, compra, venta) VALUES ('blue', '2026-09-01', 990, 1000), ('blue', '2026-09-03', 1990, 2000)`);
    // 10.000 el 01/09 (US$ 10), 5.000 el 02/09 (US$ 5), 4.000 el 03/09 (US$ 2). 15 h de Argentina.
    for (const [dia, total] of [
      ['2026-09-01', 10000],
      ['2026-09-02', 5000],
      ['2026-09-03', 4000],
    ] as const) {
      await db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, forma_pago, fecha, total_sin_interes, total_con_interes) VALUES ($1, $2, $3, 'efectivo', $4, $5, $5)`, [
        randomUUID(),
        empresa,
        usuario,
        `${dia}T18:00:00Z`,
        total,
      ]);
    }
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('en pesos, como siempre', async () => {
    const r = await request(s()).get(`/analytics/periodo?${RANGO}`).set(DUENO).expect(200);
    expect(r.body.data.total).toBe(19000);
  });

  it('en dólares: cada venta con la cotización de su día (y el fin de semana, la del día anterior)', async () => {
    const r = await request(s()).get(`/analytics/periodo?${RANGO}&moneda=USD`).set(DUENO).expect(200);
    expect(r.body.data.total).toBeCloseTo(17, 6);
    expect(r.body.data.evolucionDiaria.map((d: { total: number }) => Math.round(d.total * 100) / 100)).toEqual([10, 5, 2]);
    expect(r.body.data.formasPago[0].total).toBeCloseTo(17, 6);
  });

  it('rendimiento y contabilidad también', async () => {
    const r = await request(s()).get(`/analytics/rendimiento?${RANGO}&moneda=USD`).set(DUENO).expect(200);
    expect(r.body.porVendedor[0].total).toBeCloseTo(17, 6);
    const c = await request(s()).get(`/contabilidad?${RANGO}&moneda=USD`).set(DUENO).expect(200);
    expect(c.body.totales.ingresos).toBeCloseTo(17, 6);
  });

  it('Insights también: los totales del historial salen en dólares', async () => {
    const pesos = await request(s()).get('/analytics/insights').set(DUENO).expect(200);
    const usd = await request(s()).get('/analytics/insights?moneda=USD').set(DUENO).expect(200);
    const suma = (r: { body: { serieDiaria: { total: number }[] } }) => r.body.serieDiaria.reduce((a, x) => a + x.total, 0);
    expect(suma(pesos)).toBe(19_000);
    expect(suma(usd)).toBeCloseTo(17, 6);
  });

  it('el Inicio acepta dólares', async () => {
    await request(s()).get('/analytics/dashboard?moneda=USD').set(DUENO).expect(200);
    await request(s()).get('/analytics/dashboard?moneda=EUR').set(DUENO).expect(400);
  });

  it('cada empresa elige su dólar; si todavía no hay cotización, lo dice claro', async () => {
    const hoy = await request(s()).get('/cotizaciones/hoy').set(DUENO).expect(200);
    expect(hoy.body).toMatchObject({ casa: 'blue', venta: 2000 });
    await request(s()).patch('/configuracion').set(DUENO).send({ dolarTipo: 'oficial' }).expect(200);
    const r = await request(s()).get(`/analytics/periodo?${RANGO}&moneda=USD`).set(DUENO).expect(503);
    expect(r.body.message).toContain('cotización del dólar');
    await request(s()).patch('/configuracion').set(DUENO).send({ dolarTipo: 'euro' }).expect(400);
  });
});
