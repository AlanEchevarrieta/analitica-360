// Órdenes de trabajo (módulo de servicios, pieza 2) de punta a punta: plan Pro, seña (cobro
// del cliente con recibo), etapas con historial, entrega (venta con mano de obra y repuestos,
// la seña aplicada con su fecha y la caja que lo cuenta ese día), desde un presupuesto,
// cancelación con seña devuelta, PDF y aislamiento.
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts ordenes-trabajo
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

describe.skipIf(!URL_E2E)('Órdenes de trabajo (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const basica = randomUUID();
  const dueno = randomUUID();
  const tecnico = randomUUID();
  const cliente = randomUUID();
  const repuesto = randomUUID();
  const DUENO = { Authorization: `Bearer user_otd_${sufijo}|org_ot_${sufijo}` };
  const BASICO = { Authorization: `Bearer user_otb_${sufijo}|org_otb_${sufijo}` };
  let manoDeObra = '';
  let ot = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const usuario = (id: string, emp: string, user: string, rol: string) => db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [id, emp, user.includes('otd') ? 'Dueña' : 'Técnico', `${user}@e2e.test`, user, rol]);
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `Service ${sufijo}`, `org_ot_${sufijo}`]);
    await usuario(dueno, empresa, `user_otd_${sufijo}`, 'dueno');
    await usuario(tecnico, empresa, `user_ott_${sufijo}`, 'operador');
    await suscripcionActiva(db, empresa, 'pro');
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [basica, `ServiceB ${sufijo}`, `org_otb_${sufijo}`]);
    await usuario(randomUUID(), basica, `user_otb_${sufijo}`, 'dueno');
    await suscripcionActiva(db, basica, 'basico');
    await db.query(`INSERT INTO clientes (id, empresa_id, nombre, telefono) VALUES ($1, $2, 'Laura Pérez', '2615551234')`, [cliente, empresa]);
    await db.query(`INSERT INTO productos (id, empresa_id, nombre, costo, precio_venta) VALUES ($1, $2, 'Pantalla 15"', 30000, 60000)`, [repuesto, empresa]);
    await db.query(`INSERT INTO movimientos_inventario (id, empresa_id, producto_id, usuario_id, tipo, cantidad, signo, fecha) VALUES ($1, $2, $3, $4, 'ajuste_positivo', 3, 1, now())`, [randomUUID(), empresa, repuesto, dueno]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
    manoDeObra = (await request(app.getHttpServer()).post('/productos').set(DUENO).send({ nombre: 'Mano de obra', precioVenta: 25_000, esServicio: true, modoPrecio: 'por_hora' }).expect(201)).body.id;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const api = () => request(app.getHttpServer());

  it('en el Básico no hay órdenes de trabajo', async () => {
    expect((await api().get('/ordenes-trabajo').set(BASICO).expect(403)).body.code).toBe('plan_insuficiente');
  });

  it('la seña pide el cliente cargado', async () => {
    const r = await api().post('/ordenes-trabajo').set(DUENO).send({ equipo: 'Notebook', clienteNombre: 'Juan', senia: { monto: 10_000, formaPago: 'efectivo' } }).expect(400);
    expect(r.body.message).toContain('cliente');
  });

  it('se recibe con seña, responsable y fecha prometida; la seña queda como pago del cliente', async () => {
    const r = await api()
      .post('/ordenes-trabajo')
      .set(DUENO)
      .send({ clienteId: cliente, equipo: 'Notebook Lenovo con cargador', problema: 'No prende', responsableId: tecnico, fechaPrometida: '2026-10-20', senia: { monto: 20_000, formaPago: 'transferencia' } })
      .expect(201);
    ot = r.body.id;
    expect(r.body).toMatchObject({ numero: 'OT-000001', estado: 'recibido', clienteNombre: 'Laura Pérez', clienteTelefono: '2615551234', responsable: 'Técnico', senia: { monto: 20_000, formaPago: 'transferencia' }, total: 0 });
    expect(r.body.historial.map((h: { estado: string }) => h.estado)).toEqual(['recibido']);
    const cuenta = await api().get(`/cuenta-corriente/${cliente}`).set(DUENO).expect(200);
    expect(cuenta.body.cobros[0]).toMatchObject({ monto: 20_000, formaPago: 'transferencia', ventas: [] });
    const pdf = await api().get(`/documentos/orden_trabajo/${ot}/pdf`).set(DUENO).expect(200);
    expect(pdf.headers['content-disposition']).toContain('orden-de-trabajo-OT-000001.pdf');
    const recibo = await api().get(`/documentos/recibo/${r.body.senia.cobroId}/pdf`).set(DUENO).expect(200);
    expect(recibo.headers['content-type']).toContain('application/pdf');
  });

  it('se cargan mano de obra y repuestos, y avanza por etapas', async () => {
    const e = await api().put(`/ordenes-trabajo/${ot}`).set(DUENO).send({ clienteId: cliente, equipo: 'Notebook Lenovo con cargador', problema: 'No prende', responsableId: tecnico, items: [{ productoId: manoDeObra, cantidad: 2, precioUnitario: 25_000 }, { productoId: repuesto, cantidad: 1, precioUnitario: 60_000 }] }).expect(200);
    expect(e.body).toMatchObject({ total: 110_000, saldo: 90_000 });
    expect(e.body.items.map((i: { stock: number | null }) => i.stock)).toEqual([null, 3]);
    await api().post(`/ordenes-trabajo/${ot}/estado`).set(DUENO).send({ estado: 'en_proceso' }).expect(201);
    const l = await api().post(`/ordenes-trabajo/${ot}/estado`).set(DUENO).send({ estado: 'listo', nota: 'Se cambió la pantalla' }).expect(201);
    expect(l.body.historial.map((h: { estado: string }) => h.estado)).toEqual(['recibido', 'en_proceso', 'listo']);
  });

  it('al entregar: venta por el total, cobra lo que falta, aplica la seña con su fecha y descuenta solo el repuesto', async () => {
    // La seña "entró" hace 5 días: la caja la tiene que contar ese día.
    const { rows } = await db.query(`SELECT senia_cobro_id FROM ordenes_trabajo WHERE id = $1`, [ot]);
    await db.query(`UPDATE cobros_clientes SET fecha = now() - interval '5 days' WHERE id = $1`, [rows[0].senia_cobro_id]);
    const r = await api().post(`/ordenes-trabajo/${ot}/entregar`).set(DUENO).send({ formaPago: 'efectivo' }).expect(201);
    expect(r.body).toMatchObject({ estado: 'entregado' });
    expect(r.body.numeroVenta).toMatch(/^V-/);
    const v = (await db.query(`SELECT total_con_interes::int AS total, monto_senia::int AS ahora, saldo_pendiente::int AS saldo, estado_cobro FROM ventas WHERE id = $1`, [r.body.ventaId])).rows[0];
    expect(v).toEqual({ total: 110_000, ahora: 90_000, saldo: 0, estado_cobro: 'pagado' });
    const stock = (await db.query(`SELECT producto_id, SUM(cantidad * signo)::int AS s FROM movimientos_inventario WHERE empresa_id = $1 GROUP BY 1`, [empresa])).rows;
    expect(stock).toEqual([{ producto_id: repuesto, s: 2 }]);
    // Caja: 20.000 el día de la seña y 90.000 hoy.
    const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    const hace5 = new Date(Date.now() - 3 * 3600_000 - 5 * 86_400_000).toISOString().slice(0, 10);
    const flujo = await db.query(
      `SELECT d::text, SUM(m)::int AS m FROM (
         SELECT (v.fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date d, CASE WHEN v.es_senia THEN v.monto_senia ELSE v.total_con_interes END m FROM ventas v WHERE v.id = $1
         UNION ALL SELECT (c.fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, a.monto FROM cobros_aplicaciones a JOIN cobros_clientes c ON c.id = a.cobro_id WHERE a.venta_id = $1
       ) t GROUP BY d ORDER BY d`,
      [r.body.ventaId],
    );
    expect(flujo.rows).toEqual([{ d: hace5, m: 20_000 }, { d: hoy, m: 90_000 }]);
    await api().post(`/ordenes-trabajo/${ot}/estado`).set(DUENO).send({ estado: 'listo' }).expect(400);
  });

  it('desde un presupuesto: copia cliente e ítems y el presupuesto queda aceptado', async () => {
    const p = await api().post('/presupuestos').set(DUENO).send({ clienteId: cliente, items: [{ productoId: manoDeObra, cantidad: 1, precioUnitario: 25_000 }], descuento: 0 }).expect(201);
    const r = await api().post(`/ordenes-trabajo/desde-presupuesto/${p.body.id}`).set(DUENO).send({ equipo: 'Impresora HP' }).expect(201);
    expect(r.body).toMatchObject({ numero: 'OT-000002', clienteNombre: 'Laura Pérez', total: 25_000, presupuestoId: p.body.id });
    expect((await api().get(`/presupuestos/${p.body.id}`).set(DUENO).expect(200)).body.estado).toBe('aceptado');
    await api().post(`/ordenes-trabajo/desde-presupuesto/${p.body.id}`).set(DUENO).send({ equipo: 'Otra' }).expect(409);
  });

  it('cancelar devuelve la seña (el cobro se anula) y el presupuesto vuelve a pendiente', async () => {
    const r = await api().post('/ordenes-trabajo').set(DUENO).send({ clienteId: cliente, equipo: 'Celular', senia: { monto: 5_000, formaPago: 'efectivo' } }).expect(201);
    const c = await api().post(`/ordenes-trabajo/${r.body.id}/cancelar`).set(DUENO).send({ motivo: 'No quiso esperar' }).expect(201);
    expect(c.body).toMatchObject({ estado: 'cancelada', senia: null });
    const anulado = (await db.query(`SELECT anulado_at FROM cobros_clientes WHERE id = $1`, [r.body.senia.cobroId])).rows[0];
    expect(anulado.anulado_at).not.toBeNull();
    const lista = await api().get('/ordenes-trabajo?estado=abiertas').set(DUENO).expect(200);
    expect(lista.body.map((o: { numero: string }) => o.numero)).toEqual(['OT-000002']);
  });

  it('la seña no puede superar el total al entregar', async () => {
    const r = await api().post('/ordenes-trabajo').set(DUENO).send({ clienteId: cliente, equipo: 'Tablet', senia: { monto: 50_000, formaPago: 'efectivo' }, items: [] }).expect(201);
    await api().put(`/ordenes-trabajo/${r.body.id}`).set(DUENO).send({ clienteId: cliente, equipo: 'Tablet', items: [{ productoId: manoDeObra, cantidad: 1, precioUnitario: 25_000 }] }).expect(400);
  });
});
