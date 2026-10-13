// Comisiones por profesional (módulo de servicios, pieza 5) de punta a punta: plan Pro, % de
// servicios y de productos y fijo por sesión de abono; la venta queda del profesional por Nueva
// venta, por el turno cobrado o por la orden de trabajo entregada; descuento y devoluciones;
// ventas sin asignar; cada uno ve lo suyo; pago con gasto (y anularlo); aislamiento.
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts comisiones
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

const HOY = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

describe.skipIf(!URL_E2E)('Comisiones (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const otra = randomUUID();
  const basica = randomUUID();
  const sofiUsuario = randomUUID();
  const cliente = randomUUID();
  const shampoo = randomUUID();
  const DUENO = { Authorization: `Bearer user_cod_${sufijo}|org_co_${sufijo}` };
  const SOFI = { Authorization: `Bearer user_cos_${sufijo}|org_co_${sufijo}` };
  const OTRA = { Authorization: `Bearer user_coo_${sufijo}|org_coo_${sufijo}` };
  const BASICO = { Authorization: `Bearer user_cob_${sufijo}|org_cob_${sufijo}` };
  let corte = '';
  let sofi = '';
  let lu = '';
  let sinAsignar = '';
  const rango = { desde: HOY, hasta: HOY };

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const alta = async (emp: string, org: string, plan: 'pro' | 'basico', usuarios: [string, string, string][]) => {
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [emp, `Pelu ${org}`, org]);
      for (const [id, user, rol] of usuarios) await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [id, emp, user, `${user}@e2e.test`, user, rol]);
      await suscripcionActiva(db, emp, plan);
    };
    await alta(empresa, `org_co_${sufijo}`, 'pro', [[randomUUID(), `user_cod_${sufijo}`, 'dueno'], [sofiUsuario, `user_cos_${sufijo}`, 'operador']]);
    await alta(otra, `org_coo_${sufijo}`, 'pro', [[randomUUID(), `user_coo_${sufijo}`, 'dueno']]);
    await alta(basica, `org_cob_${sufijo}`, 'basico', [[randomUUID(), `user_cob_${sufijo}`, 'dueno']]);
    await db.query(`INSERT INTO clientes (id, empresa_id, nombre) VALUES ($1, $2, 'Laura Pérez')`, [cliente, empresa]);
    await db.query(`INSERT INTO productos (id, empresa_id, nombre, costo, precio_venta) VALUES ($1, $2, 'Shampoo', 2000, 5000)`, [shampoo, empresa]);
    await db.query(`INSERT INTO movimientos_inventario (id, empresa_id, producto_id, usuario_id, tipo, cantidad, signo, fecha) VALUES ($1, $2, $3, $4, 'ajuste_positivo', 20, 1, now())`, [randomUUID(), empresa, shampoo, sofiUsuario]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
    const api = request(app.getHttpServer());
    corte = (await api.post('/productos').set(DUENO).send({ nombre: 'Corte', precioVenta: 10_000, esServicio: true, modoPrecio: 'fijo', duracionMin: 30 }).expect(201)).body.id;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const api = () => request(app.getHttpServer());
  const vender = (body: Record<string, unknown>, quien = SOFI) => api().post('/ventas').set(quien).send({ formaPago: 'efectivo', ...body }).expect(201);
  const liquidacion = async () => (await api().get('/comisiones').query(rango).set(DUENO).expect(200)).body.profesionales as { id: string; total: number; [k: string]: unknown }[];
  const de = async (id: string) => (await liquidacion()).find((p) => p.id === id)!;

  it('en el Básico no hay comisiones', async () => {
    expect((await api().get('/comisiones').query(rango).set(BASICO).expect(403)).body.code).toBe('plan_insuficiente');
  });

  it('cada profesional tiene sus porcentajes; un usuario no puede ser dos profesionales', async () => {
    sofi = (await api().post('/agenda/recursos').set(DUENO).send({ nombre: 'Sofi', usuarioId: sofiUsuario, comisionServicios: 40, comisionProductos: 10, comisionSesion: 1_500, horarios: [] }).expect(201)).body.id;
    lu = (await api().post('/agenda/recursos').set(DUENO).send({ nombre: 'Lu', comisionServicios: 50, horarios: [] }).expect(201)).body.id;
    await api().post('/agenda/recursos').set(DUENO).send({ nombre: 'Otra Sofi', usuarioId: sofiUsuario, horarios: [] }).expect(400);
    expect((await api().get('/agenda/recursos').set(DUENO).expect(200)).body.find((r: { id: string }) => r.id === sofi)).toMatchObject({ comisionServicios: 40, comisionProductos: 10, comisionSesion: 1500 });
  });

  it('Nueva venta con "atendió": servicio y producto, con el descuento repartido', async () => {
    // $10.000 corte + $5.000 shampoo, $1.500 de descuento (10 %): base $9.000 + $4.500.
    await vender({ profesionalId: sofi, descuento: 1_500, items: [{ productoId: corte, cantidad: 1, precioUnitario: 10_000 }, { productoId: shampoo, cantidad: 1, precioUnitario: 5_000 }] });
    expect(await de(sofi)).toMatchObject({ baseServicios: 9000, baseProductos: 4500, porServicios: 3600, porProductos: 450, total: 4050 });
  });

  it('el turno cobrado queda del profesional del turno', async () => {
    const turno = (await api().post('/agenda/turnos').set(DUENO).send({ recursoId: lu, servicioId: corte, clienteId: cliente, inicio: `${HOY}T10:00`, forzar: true }).expect(201)).body.id;
    const venta = (await vender({ items: [{ productoId: corte, cantidad: 1, precioUnitario: 10_000 }] }, DUENO)).body.id;
    await api().post(`/agenda/turnos/${turno}/cobrado`).set(DUENO).send({ ventaId: venta }).expect(201);
    expect(await de(lu)).toMatchObject({ baseServicios: 10000, total: 5000 });
  });

  it('lo devuelto resta', async () => {
    const venta = (await vender({ profesionalId: sofi, items: [{ productoId: shampoo, cantidad: 2, precioUnitario: 5_000 }] })).body.id;
    const dev = randomUUID();
    await db.query(`INSERT INTO devoluciones (id, empresa_id, venta_id, tipo, estado) VALUES ($1, $2, $3, 'devolucion', 'procesado')`, [dev, empresa, venta]);
    await db.query(`INSERT INTO devoluciones_items (id, devolucion_id, producto_id, cantidad, precio_unitario, tipo) VALUES ($1, $2, $3, 1, 5000, 'devuelto')`, [randomUUID(), dev, shampoo]);
    // Shampoo: $4.500 de antes + $10.000 − $5.000 devuelto = $9.500.
    expect(await de(sofi)).toMatchObject({ baseProductos: 9500, porProductos: 950 });
  });

  it('una sesión de abono atendida desde la agenda suma el fijo', async () => {
    const plan = (await api().post('/abonos/planes').set(DUENO).send({ nombre: '4 clases', tipo: 'mensual', precio: 30_000, sesiones: 4 }).expect(201)).body.id;
    const abono = (await api().post('/abonos').set(DUENO).send({ clienteId: cliente, planId: plan, cobro: { formaPago: 'efectivo' } }).expect(201)).body.id;
    const turno = (await api().post('/agenda/turnos').set(DUENO).send({ recursoId: sofi, clienteId: cliente, inicio: `${HOY}T12:00`, forzar: true }).expect(201)).body.id;
    await api().post(`/abonos/${abono}/usar`).set(DUENO).send({ turnoId: turno }).expect(201);
    expect(await de(sofi)).toMatchObject({ sesiones: 1, porSesiones: 1500 });
    // La venta del abono (sin profesional) no cuenta para nadie.
    expect((await de(lu)).total).toBe(5000);
  });

  it('ventas con servicios sin profesional: se listan y se asignan', async () => {
    sinAsignar = (await vender({ items: [{ productoId: corte, cantidad: 1, precioUnitario: 8_000 }] }, DUENO)).body.id;
    const lista = (await api().get('/comisiones/sin-asignar').query(rango).set(DUENO).expect(200)).body.map((v: { id: string }) => v.id);
    expect(lista).toContain(sinAsignar);
    await api().put(`/comisiones/ventas/${sinAsignar}`).set(DUENO).send({ profesionalId: lu }).expect(200);
    expect((await de(lu)).total).toBe(9000);
    await api().put(`/comisiones/ventas/${sinAsignar}`).set(OTRA).send({ profesionalId: lu }).expect(404);
  });

  it('la orden de trabajo entregada queda del profesional del responsable', async () => {
    const ot = (await api().post('/ordenes-trabajo').set(DUENO).send({ equipo: 'Tintura', clienteNombre: 'Caro', responsableId: sofiUsuario, items: [{ productoId: corte, cantidad: 1, precioUnitario: 20_000 }] }).expect(201)).body.id;
    const r = (await api().post(`/ordenes-trabajo/${ot}/entregar`).set(DUENO).send({ formaPago: 'efectivo' }).expect(201)).body;
    expect((await db.query(`SELECT profesional_id FROM ventas WHERE id = $1`, [r.ventaId])).rows[0].profesional_id).toBe(sofi);
    // Servicios de Sofi: $9.000 + $20.000 = $29.000 al 40 %.
    expect(await de(sofi)).toMatchObject({ baseServicios: 29000, porServicios: 11600 });
  });

  it('cada profesional ve solo lo suyo', async () => {
    await api().get('/comisiones').query(rango).set(SOFI).expect(403);
    const mias = (await api().get('/comisiones/mias').query(rango).set(SOFI).expect(200)).body.profesionales;
    expect(mias.map((p: { nombre: string }) => p.nombre)).toEqual(['Sofi']);
  });

  it('pagar: queda el pago y el gasto (sueldos); anularlo borra el gasto', async () => {
    const total = (await de(sofi)).total;
    const pago = (await api().post('/comisiones/pagos').set(DUENO).send({ recursoId: sofi, ...rango, monto: total }).expect(201)).body.id;
    expect(await de(sofi)).toMatchObject({ pagado: total, pendiente: 0 });
    const gasto = (await db.query(`SELECT g.categoria, g.monto::float AS monto, g.descripcion, g.deleted_at FROM gastos g JOIN comision_pagos p ON p.gasto_id = g.id WHERE p.id = $1`, [pago])).rows[0];
    expect(gasto).toMatchObject({ categoria: 'sueldos', monto: total, deleted_at: null });
    expect(gasto.descripcion).toContain('Comisiones de Sofi');
    await api().post('/comisiones/pagos').set(SOFI).send({ recursoId: sofi, ...rango, monto: 1 }).expect(403);
    await api().delete(`/comisiones/pagos/${pago}`).set(DUENO).expect(200);
    expect((await de(sofi)).pendiente).toBe(total);
    expect((await db.query(`SELECT count(*)::int AS n FROM gastos WHERE empresa_id = $1 AND categoria = 'sueldos' AND deleted_at IS NULL`, [empresa])).rows[0].n).toBe(0);
  });

  it('otra empresa no ve nada', async () => {
    expect((await api().get('/comisiones').query(rango).set(OTRA).expect(200)).body.profesionales).toEqual([]);
    await api().post('/comisiones/pagos').set(OTRA).send({ recursoId: sofi, ...rango, monto: 100 }).expect(404);
  });
});
