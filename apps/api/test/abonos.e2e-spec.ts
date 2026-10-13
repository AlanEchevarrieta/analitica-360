// Abonos (módulo de servicios, pieza 4) de punta a punta: plan Pro, planes mensuales y paquetes
// (con su servicio para la venta), alta con cobro, renovación pegada, cuota a cuenta (deuda),
// sesiones que no se pasan, sesión usada desde un turno de la agenda, vencidos, aumentos,
// baja y aislamiento.
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts abonos
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { finPeriodo, sumarDias } from '../src/modules/abonos/abonos.util.js';
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

describe.skipIf(!URL_E2E)('Abonos (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const otra = randomUUID();
  const basica = randomUUID();
  const laura = randomUUID();
  const juan = randomUUID();
  const DUENO = { Authorization: `Bearer user_abd_${sufijo}|org_ab_${sufijo}` };
  const VENDEDOR = { Authorization: `Bearer user_abv_${sufijo}|org_ab_${sufijo}` };
  const OTRA = { Authorization: `Bearer user_abo_${sufijo}|org_abo_${sufijo}` };
  const BASICO = { Authorization: `Bearer user_abb_${sufijo}|org_abb_${sufijo}` };
  let pase = '';
  let paquete = '';
  let abonoLaura = '';
  let abonoJuan = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const alta = async (emp: string, org: string, plan: 'pro' | 'basico', usuarios: [string, string][]) => {
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [emp, `Gym ${org}`, org]);
      for (const [user, rol] of usuarios) await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [randomUUID(), emp, user, `${user}@e2e.test`, user, rol]);
      await suscripcionActiva(db, emp, plan);
    };
    await alta(empresa, `org_ab_${sufijo}`, 'pro', [[`user_abd_${sufijo}`, 'dueno'], [`user_abv_${sufijo}`, 'operador']]);
    await alta(otra, `org_abo_${sufijo}`, 'pro', [[`user_abo_${sufijo}`, 'dueno']]);
    await alta(basica, `org_abb_${sufijo}`, 'basico', [[`user_abb_${sufijo}`, 'dueno']]);
    await db.query(`INSERT INTO clientes (id, empresa_id, nombre, telefono) VALUES ($1, $3, 'Laura Pérez', '2615551234'), ($2, $3, 'Juan Gómez', NULL)`, [laura, juan, empresa]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const api = () => request(app.getHttpServer());
  const ficha = async (id: string) => (await api().get(`/abonos/${id}`).set(VENDEDOR).expect(200)).body;

  it('en el Básico no hay abonos', async () => {
    expect((await api().get('/abonos').set(BASICO).expect(403)).body.code).toBe('plan_insuficiente');
  });

  it('el dueño arma los planes (con su servicio para la venta); el paquete pide sesiones', async () => {
    await api().post('/abonos/planes').set(VENDEDOR).send({ nombre: 'Pase libre', tipo: 'mensual', precio: 25_000 }).expect(403);
    await api().post('/abonos/planes').set(DUENO).send({ nombre: 'Paquete', tipo: 'paquete', precio: 30_000 }).expect(400);
    pase = (await api().post('/abonos/planes').set(DUENO).send({ nombre: 'Pase libre', tipo: 'mensual', precio: 25_000 }).expect(201)).body.id;
    const r = await api().post('/abonos/planes').set(DUENO).send({ nombre: '2 clases de prueba', tipo: 'paquete', precio: 30_000, sesiones: 2, vigenciaDias: 30 }).expect(201);
    paquete = r.body.id;
    const producto = (await db.query(`SELECT nombre, es_servicio, precio_venta::float AS precio FROM productos WHERE id = $1`, [r.body.productoId])).rows[0];
    expect(producto).toEqual({ nombre: '2 clases de prueba', es_servicio: true, precio: 30000 });
  });

  it('alta con cobro: una venta del servicio y el primer período desde hoy', async () => {
    const a = (await api().post('/abonos').set(VENDEDOR).send({ clienteId: laura, planId: pase, cobro: { formaPago: 'efectivo' } }).expect(201)).body;
    abonoLaura = a.id;
    expect(a).toMatchObject({ cliente: 'Laura Pérez', plan: 'Pase libre', precio: 25000, estado: 'al_dia', deuda: 0, sesionesRestantes: null });
    expect(a.periodos).toEqual([expect.objectContaining({ desde: HOY, hasta: finPeriodo('mensual', HOY, null), monto: 25000 })]);
    const venta = (await db.query(`SELECT v.cliente_id, v.forma_pago, v.total_con_interes::float AS total, p.nombre FROM ventas v JOIN ventas_items i ON i.venta_id = v.id JOIN productos p ON p.id = i.producto_id WHERE v.id = $1`, [a.periodos[0].ventaId])).rows[0];
    expect(venta).toEqual({ cliente_id: laura, forma_pago: 'efectivo', total: 25000, nombre: 'Pase libre' });
    await api().post('/abonos').set(VENDEDOR).send({ clienteId: laura, planId: pase }).expect(409);
  });

  it('renovar por adelantado sigue pegado al período anterior y no se pisa', async () => {
    const a = (await api().post(`/abonos/${abonoLaura}/cobrar`).set(VENDEDOR).send({ formaPago: 'transferencia' }).expect(201)).body;
    const primero = finPeriodo('mensual', HOY, null);
    expect(a.periodos[1]).toMatchObject({ desde: sumarDias(primero, 1), hasta: finPeriodo('mensual', sumarDias(primero, 1), null) });
    await api().post(`/abonos/${abonoLaura}/cobrar`).set(VENDEDOR).send({ formaPago: 'efectivo', desde: HOY }).expect(409);
  });

  it('paquete a cuenta: queda la deuda y las sesiones no se pasan', async () => {
    const a = (await api().post('/abonos').set(VENDEDOR).send({ clienteId: juan, planId: paquete, cobro: { formaPago: 'cuenta_corriente' } }).expect(201)).body;
    abonoJuan = a.id;
    expect(a).toMatchObject({ estado: 'al_dia', deuda: 30000, sesionesRestantes: 2 });
    expect((await api().get('/abonos').query({ estado: 'con_deuda' }).set(VENDEDOR).expect(200)).body.filas.map((f: { id: string }) => f.id)).toEqual([abonoJuan]);
    await api().post(`/abonos/${abonoJuan}/usar`).set(VENDEDOR).send({}).expect(201);
    // Las dos últimas a la vez: entra una sola.
    const [x, y] = await Promise.all([api().post(`/abonos/${abonoJuan}/usar`).set(VENDEDOR).send({}), api().post(`/abonos/${abonoJuan}/usar`).set(VENDEDOR).send({})]);
    expect([x.status, y.status].sort()).toEqual([201, 400]);
    const f = await ficha(abonoJuan);
    expect(f).toMatchObject({ estado: 'sin_sesiones', sesionesRestantes: 0 });
    expect(f.usos).toHaveLength(2);
    // Una marcada por error se deshace y la sesión vuelve.
    const deshecho = (await api().delete(`/abonos/${abonoJuan}/usos/${f.usos[0].id}`).set(VENDEDOR).expect(200)).body;
    expect(deshecho).toMatchObject({ estado: 'al_dia', sesionesRestantes: 1 });
  });

  it('una sesión desde un turno de la agenda: queda atendido, sin venta, y no se cambia', async () => {
    const recurso = (await api().post('/agenda/recursos').set(DUENO).send({ nombre: 'Profe', horarios: [] }).expect(201)).body.id;
    const turno = (await api().post('/agenda/turnos').set(VENDEDOR).send({ recursoId: recurso, clienteId: juan, inicio: `${HOY}T10:00`, duracionMin: 60, forzar: true }).expect(201)).body.id;
    const otroCliente = (await api().post('/agenda/turnos').set(VENDEDOR).send({ recursoId: recurso, clienteId: laura, inicio: `${HOY}T12:00`, duracionMin: 60, forzar: true }).expect(201)).body.id;
    await api().post(`/abonos/${abonoJuan}/usar`).set(VENDEDOR).send({ turnoId: otroCliente }).expect(400);
    await api().post(`/abonos/${abonoJuan}/usar`).set(VENDEDOR).send({ turnoId: turno }).expect(201);
    const [t] = (await api().get('/agenda/turnos').query({ desde: HOY, hasta: HOY }).set(VENDEDOR).expect(200)).body.filter((x: { id: string }) => x.id === turno);
    expect(t).toMatchObject({ estado: 'atendido', abonoId: abonoJuan, ventaId: null });
    await api().post(`/agenda/turnos/${turno}/estado`).set(VENDEDOR).send({ estado: 'cancelado' }).expect(400);
    expect((await api().get(`/abonos/cliente/${juan}`).set(VENDEDOR).expect(200)).body).toEqual([expect.objectContaining({ id: abonoJuan, sesionesRestantes: 0 })]);
  });

  it('vencido: arriba de la lista, con su WhatsApp, y renovar a tiempo sigue desde donde terminó', async () => {
    const otro = randomUUID();
    await db.query(`INSERT INTO clientes (id, empresa_id, nombre, telefono) VALUES ($1, $2, 'Caro Díaz', '2614440000')`, [otro, empresa]);
    const desde = sumarDias(HOY, -35);
    const a = (await api().post('/abonos').set(VENDEDOR).send({ clienteId: otro, planId: pase, cobro: { formaPago: 'efectivo', desde } }).expect(201)).body;
    expect(a.estado).toBe('vencido');
    const lista = (await api().get('/abonos').set(VENDEDOR).expect(200)).body;
    expect(lista.filas[0].id).toBe(a.id);
    expect(lista.resumen).toMatchObject({ activos: 3, vencidos: 1, deuda: 30000, mensual: 50000 });
    const m = (await api().post(`/abonos/${a.id}/mensaje`).set(VENDEDOR).expect(201)).body;
    expect(m.mensaje).toContain('Hola Caro! Tu Pase libre venció el');
    expect(m.whatsapp).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    const hasta = finPeriodo('mensual', desde, null);
    const r = (await api().post(`/abonos/${a.id}/cobrar`).set(VENDEDOR).send({ formaPago: 'efectivo' }).expect(201)).body;
    expect(r.periodos[1].desde).toBe(sumarDias(hasta, 1));
  });

  it('aumento del plan: se puede llevar a los abonos activos', async () => {
    await api().put(`/abonos/planes/${pase}`).set(DUENO).send({ nombre: 'Pase libre', tipo: 'mensual', precio: 28_000, actualizarAbonos: true }).expect(200);
    expect((await ficha(abonoLaura)).precio).toBe(28000);
    expect((await db.query(`SELECT precio_venta::float AS p FROM productos p JOIN abono_planes a ON a.producto_id = p.id WHERE a.id = $1`, [pase])).rows[0].p).toBe(28000);
  });

  it('baja y reactivar; no se borra un plan con abonados', async () => {
    expect((await api().post(`/abonos/${abonoJuan}/baja`).set(VENDEDOR).expect(201)).body.estado).toBe('baja');
    await api().post(`/abonos/${abonoJuan}/cobrar`).set(VENDEDOR).send({ formaPago: 'efectivo' }).expect(400);
    expect((await api().post(`/abonos/${abonoJuan}/reactivar`).set(VENDEDOR).expect(201)).body.estado).not.toBe('baja');
    expect((await api().delete(`/abonos/planes/${pase}`).set(DUENO).expect(400)).body.message).toContain('abonados activos');
  });

  it('otra empresa no ve ni toca nada', async () => {
    expect((await api().get('/abonos').set(OTRA).expect(200)).body.filas).toEqual([]);
    await api().get(`/abonos/${abonoLaura}`).set(OTRA).expect(404);
    await api().post(`/abonos/${abonoLaura}/usar`).set(OTRA).send({}).expect(404);
    await api().post('/abonos').set(OTRA).send({ clienteId: laura, planId: pase }).expect(400);
  });
});
