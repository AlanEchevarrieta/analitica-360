// Presupuestos de punta a punta (AppModule completo, guards reales): plan Pro,
// numeración, validez por defecto, stock de hoy, PDF, editar, rechazar,
// pasar a venta (una sola vez) y aislamiento entre empresas.
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts presupuestos
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

describe.skipIf(!URL_E2E)('Presupuestos (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const pro = randomUUID();
  const basico = randomUUID();
  const dueno = randomUUID();
  const mate = randomUUID();
  const bombilla = randomUUID();
  const ajeno = randomUUID();
  const cliente = randomUUID();
  const PRO = { Authorization: `Bearer user_ppd_${sufijo}|org_pp_${sufijo}` };
  const LECTOR = { Authorization: `Bearer user_ppl_${sufijo}|org_pp_${sufijo}` };
  const BASICO = { Authorization: `Bearer user_pbd_${sufijo}|org_pb_${sufijo}` };
  let id = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const usuario = (uid: string, emp: string, user: string, rol: string, permisos = '{}') =>
      db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol, permisos) VALUES ($1, $2, 'U', $3, $4, $5, $6)`, [uid, emp, `${user}@e2e.test`, user, rol, permisos]);
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [pro, `Pres ${sufijo}`, `org_pp_${sufijo}`]);
    await usuario(dueno, pro, `user_ppd_${sufijo}`, 'dueno');
    await usuario(randomUUID(), pro, `user_ppl_${sufijo}`, 'contador');
    await suscripcionActiva(db, pro, 'pro');
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [basico, `PresB ${sufijo}`, `org_pb_${sufijo}`]);
    await usuario(randomUUID(), basico, `user_pbd_${sufijo}`, 'dueno');
    await suscripcionActiva(db, basico, 'basico');
    await db.query(`INSERT INTO productos (id, empresa_id, nombre) VALUES ($1, $2, 'Mate imperial'), ($3, $2, 'Bombilla')`, [mate, pro, bombilla]);
    await db.query(`INSERT INTO productos (id, empresa_id, nombre) VALUES ($1, $2, 'Termo ajeno')`, [ajeno, basico]);
    await db.query(`INSERT INTO movimientos_inventario (id, empresa_id, producto_id, usuario_id, tipo, cantidad, signo, fecha) VALUES ($1, $2, $3, $4, 'ajuste_positivo', 3, 1, now())`, [randomUUID(), pro, mate, dueno]);
    await db.query(`INSERT INTO clientes (id, empresa_id, nombre, telefono) VALUES ($1, $2, 'Hotel Andino', '2614000000')`, [cliente, pro]);
    await db.query(`INSERT INTO documentos_config (empresa_id, validez_presupuesto_dias, updated_at) VALUES ($1, 10, now())`, [pro]);

    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const api = () => request(app.getHttpServer());
  const cuerpo = (extra: Record<string, unknown> = {}) => ({
    clienteId: cliente,
    items: [
      { productoId: mate, cantidad: 5, precioUnitario: 30_000 },
      { productoId: bombilla, cantidad: 5, precioUnitario: 8_000 },
    ],
    descuento: 10_000,
    notas: 'Entrega en 7 días',
    ...extra,
  });

  it('en el plan Básico no hay presupuestos', async () => {
    const r = await api().get('/presupuestos').set(BASICO).expect(403);
    expect(r.body.code).toBe('plan_insuficiente');
  });

  it('crea el presupuesto numerado, con la validez de la configuración', async () => {
    const r = await api().post('/presupuestos').set(PRO).send(cuerpo()).expect(201);
    id = r.body.id;
    expect(r.body).toMatchObject({ numero: 'P-000001', estado: 'pendiente', clienteNombre: 'Hotel Andino', subtotal: 190_000, descuento: 10_000, total: 180_000, validoHasta: dias(10) });
    const otro = await api().post('/presupuestos').set(PRO).send(cuerpo({ clienteId: null, clienteNombre: 'Juan', descuento: 0, validoHasta: dias(3) })).expect(201);
    expect(otro.body).toMatchObject({ numero: 'P-000002', clienteNombre: 'Juan', validoHasta: dias(3) });
  });

  it('controla productos ajenos, descuento, fecha y permisos', async () => {
    await api().post('/presupuestos').set(PRO).send(cuerpo({ items: [{ productoId: ajeno, cantidad: 1, precioUnitario: 1 }] })).expect(400);
    await api().post('/presupuestos').set(PRO).send(cuerpo({ descuento: 999_999 })).expect(400);
    await api().post('/presupuestos').set(PRO).send(cuerpo({ validoHasta: dias(-1) })).expect(400);
    await api().post('/presupuestos').set(LECTOR).send(cuerpo()).expect(403);
  });

  it('la ficha trae el stock de hoy para avisar faltantes', async () => {
    const r = await api().get(`/presupuestos/${id}`).set(PRO).expect(200);
    expect(r.body.items.map((i: { descripcion: string; stock: number }) => [i.descripcion, i.stock])).toEqual([
      ['Mate imperial', 3],
      ['Bombilla', 0],
    ]);
    expect(r.body.cliente).toMatchObject({ nombre: 'Hotel Andino', telefono: '2614000000' });
  });

  it('el PDF y el link de WhatsApp salen por documentos', async () => {
    const pdf = await api().get(`/documentos/presupuesto/${id}/pdf`).set(PRO).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('presupuesto-P-000001.pdf');
    const link = await api().post(`/documentos/presupuesto/${id}/link`).set(PRO).expect(201);
    expect(link.body.telefono).toBe('5492614000000');
    expect(link.body.mensaje).toContain('presupuesto P-000001');
    await api().get(`/documentos/presupuesto/${id}/pdf`).set(BASICO).expect(404);
  });

  it('se edita, se rechaza y se reabre', async () => {
    const e = await api().put(`/presupuestos/${id}`).set(PRO).send(cuerpo({ descuento: 0, items: [{ productoId: mate, cantidad: 2, precioUnitario: 30_000 }] })).expect(200);
    expect(e.body).toMatchObject({ numero: 'P-000001', total: 60_000, validoHasta: dias(10) });
    expect((await api().post(`/presupuestos/${id}/estado`).set(PRO).send({ estado: 'rechazado' }).expect(201)).body.estado).toBe('rechazado');
    expect((await api().post(`/presupuestos/${id}/estado`).set(PRO).send({ estado: 'pendiente' }).expect(201)).body.estado).toBe('pendiente');
  });

  it('pasa a venta una sola vez y después no se puede editar', async () => {
    const venta = randomUUID();
    const otraVenta = randomUUID();
    for (const v of [venta, otraVenta]) {
      await db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, numero_venta, forma_pago, total_con_interes) VALUES ($1, $2, $3, $4, 'efectivo', 60000)`, [v, pro, dueno, v === venta ? 'V-000901' : 'V-000902']);
    }
    const r = await api().post(`/presupuestos/${id}/aceptar`).set(PRO).send({ ventaId: venta }).expect(201);
    expect(r.body).toMatchObject({ estado: 'aceptado', ventaId: venta });
    await api().post(`/presupuestos/${id}/aceptar`).set(PRO).send({ ventaId: venta }).expect(201);
    await api().post(`/presupuestos/${id}/aceptar`).set(PRO).send({ ventaId: otraVenta }).expect(409);
    await api().put(`/presupuestos/${id}`).set(PRO).send(cuerpo()).expect(400);
    await api().delete(`/presupuestos/${id}`).set(PRO).expect(400);
    const lista = await api().get('/presupuestos').set(PRO).expect(200);
    expect(lista.body.find((p: { id: string }) => p.id === id)).toMatchObject({ estado: 'aceptado', numeroVenta: 'V-000901', productos: 1 });
  });

  it('un pendiente vencido se ve como vencido y se puede borrar', async () => {
    const r = await api().post('/presupuestos').set(PRO).send(cuerpo()).expect(201);
    await db.query(`UPDATE presupuestos SET valido_hasta = $1 WHERE id = $2`, [dias(-2), r.body.id]);
    expect((await api().get(`/presupuestos/${r.body.id}`).set(PRO).expect(200)).body.estado).toBe('vencido');
    await api().delete(`/presupuestos/${r.body.id}`).set(PRO).expect(200);
    await api().get(`/presupuestos/${r.body.id}`).set(PRO).expect(404);
  });
});
