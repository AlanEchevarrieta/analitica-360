// Punto de equilibrio del mes (tarjeta de Inicio) y gastos fijos o variables, de punta a punta.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts equilibrio
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

describe.skipIf(!URL_E2E)('Punto de equilibrio (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const dueno = randomUUID();
  const producto = randomUUID();
  const DUENO = { Authorization: `Bearer user_eq_${sufijo}|org_eq_${sufijo}` };
  let variable = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `Equilibrio ${sufijo}`, `org_eq_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueña', $3, $4, 'dueno')`, [dueno, empresa, `eq_${sufijo}@e2e.test`, `user_eq_${sufijo}`]);
    await suscripcionActiva(db, empresa, 'pro');
    await db.query(`INSERT INTO productos (id, empresa_id, nombre) VALUES ($1, $2, 'Mate')`, [producto, empresa]);
    // Hoy: una venta de 1.000.000 con 350.000 de mercadería.
    const venta = randomUUID();
    await db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, forma_pago, total_con_interes, total_sin_interes) VALUES ($1, $2, $3, 'efectivo', 1000000, 1000000)`, [venta, empresa, dueno]);
    await db.query(`INSERT INTO ventas_items (id, empresa_id, venta_id, producto_id, cantidad, precio_unitario, costo_unitario) VALUES ($1, $2, $3, $4, 10, 100000, 35000)`, [randomUUID(), empresa, venta, producto]);
    app = (await Test.createTestingModule({ imports: [(await import('../src/app.module.js')).AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Mendoza' });
  const equilibrio = async () => (await request(app.getHttpServer()).get('/contabilidad/equilibrio').set(DUENO).expect(200)).body;

  it('sin gastos cargados lo dice', async () => {
    const e = await equilibrio();
    expect(e).toMatchObject({ hayGastos: false, fijos: 0 });
  });

  it('el alquiler recurrente es fijo y la comisión del día, variable', async () => {
    const alquiler = await request(app.getHttpServer())
      .post('/gastos')
      .set(DUENO)
      .send({ categoria: 'alquiler', descripcion: 'Alquiler', monto: 960_000, fecha: `${hoy().slice(0, 7)}-01`, recurrente: true, frecuencia: 'mensual' })
      .expect(201);
    expect(alquiler.body.tipoCosto).toBe('fijo');
    const comision = await request(app.getHttpServer()).post('/gastos').set(DUENO).send({ categoria: 'otro', descripcion: 'Comisión tarjeta', monto: 50_000, fecha: hoy() }).expect(201);
    expect(comision.body.tipoCosto).toBe('variable');
    variable = comision.body.id;

    // De cada $100: 35 de mercadería + 5 de gastos variables → quedan 60 para el alquiler.
    const e = await equilibrio();
    expect(e).toMatchObject({ hayGastos: true, fijos: 960_000, contribucionPct: 60, puntoEquilibrio: 1_600_000, ventas: 1_000_000, falta: 600_000, cubierto: false });
    expect(e.fijosPorCategoria).toEqual([{ categoria: 'alquiler', monto: 960_000 }]);
  });

  it('se puede pasar un gasto de variable a fijo', async () => {
    await request(app.getHttpServer()).patch(`/gastos/${variable}/tipo-costo`).set(DUENO).send({ tipoCosto: 'fijo' }).expect(204);
    const e = await equilibrio();
    // Fijos 1.010.000 y contribución 65 % → 1.553.846.
    expect(e).toMatchObject({ fijos: 1_010_000, contribucionPct: 65, puntoEquilibrio: 1_553_846 });
  });
});
