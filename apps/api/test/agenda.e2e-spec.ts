// Agenda y turnos (módulo de servicios, pieza 3) de punta a punta: plan Pro, profesionales con
// horarios, turnos que no se pisan (ni reservando a la vez), fuera de horario y días cerrados,
// horarios libres, estados, reprogramar, recordatorio por WhatsApp, cobrado con su venta y aislamiento.
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts agenda
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

// 2030-01-03 es jueves (4); 2030-01-04, viernes.
const JUEVES = '2030-01-03';

describe.skipIf(!URL_E2E)('Agenda (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const otra = randomUUID();
  const basica = randomUUID();
  const cliente = randomUUID();
  const DUENO = { Authorization: `Bearer user_agd_${sufijo}|org_ag_${sufijo}` };
  const VENDEDOR = { Authorization: `Bearer user_agv_${sufijo}|org_ag_${sufijo}` };
  const OTRA = { Authorization: `Bearer user_ago_${sufijo}|org_ago_${sufijo}` };
  const BASICO = { Authorization: `Bearer user_agb_${sufijo}|org_agb_${sufijo}` };
  let sofi = '';
  let corte = '';
  let turno = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const alta = async (emp: string, org: string, plan: 'pro' | 'basico', usuarios: [string, string][]) => {
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [emp, `Peluquería ${org}`, org]);
      for (const [user, rol] of usuarios) await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [randomUUID(), emp, user, `${user}@e2e.test`, user, rol]);
      await suscripcionActiva(db, emp, plan);
    };
    await alta(empresa, `org_ag_${sufijo}`, 'pro', [[`user_agd_${sufijo}`, 'dueno'], [`user_agv_${sufijo}`, 'operador']]);
    await alta(otra, `org_ago_${sufijo}`, 'pro', [[`user_ago_${sufijo}`, 'dueno']]);
    await alta(basica, `org_agb_${sufijo}`, 'basico', [[`user_agb_${sufijo}`, 'dueno']]);
    await db.query(`INSERT INTO clientes (id, empresa_id, nombre, telefono) VALUES ($1, $2, 'Laura Pérez', '2615551234')`, [cliente, empresa]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
    corte = (await request(app.getHttpServer()).post('/productos').set(DUENO).send({ nombre: 'Corte', precioVenta: 12_000, esServicio: true, modoPrecio: 'fijo', duracionMin: 45 }).expect(201)).body.id;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const api = () => request(app.getHttpServer());
  const reservar = (body: Record<string, unknown>, quien = VENDEDOR) => api().post('/agenda/turnos').set(quien).send({ recursoId: sofi, servicioId: corte, clienteId: cliente, ...body });

  it('en el Básico no hay agenda', async () => {
    expect((await api().get('/agenda/recursos').set(BASICO).expect(403)).body.code).toBe('plan_insuficiente');
  });

  it('el dueño da de alta profesionales con sus horarios; el vendedor no', async () => {
    await api().post('/agenda/recursos').set(DUENO).send({ nombre: 'Sofi', horarios: [{ diaSemana: 4, desde: '15:00', hasta: '12:00' }] }).expect(400);
    await api().post('/agenda/recursos').set(VENDEDOR).send({ nombre: 'Sofi', horarios: [] }).expect(403);
    const r = await api()
      .post('/agenda/recursos')
      .set(DUENO)
      .send({ nombre: 'Sofi', color: '#e11d48', horarios: [{ diaSemana: 4, desde: '09:00', hasta: '12:00' }, { diaSemana: 4, desde: '15:00', hasta: '19:00' }] })
      .expect(201);
    sofi = r.body.id;
    expect(r.body.horarios).toHaveLength(2);
    expect((await api().get('/agenda/recursos').set(VENDEDOR).expect(200)).body.map((x: { nombre: string }) => x.nombre)).toEqual(['Sofi']);
  });

  it('reserva un turno con la duración del servicio y el teléfono del cliente', async () => {
    const r = await reservar({ inicio: `${JUEVES}T10:00` }).expect(201);
    turno = r.body.id;
    expect(r.body).toMatchObject({ inicio: `${JUEVES}T10:00`, fin: `${JUEVES}T10:45`, duracionMin: 45, servicio: 'Corte', precio: 12000, clienteNombre: 'Laura Pérez', clienteTelefono: '2615551234', estado: 'reservado', recurso: 'Sofi' });
  });

  it('no se pisan: ni uno encima de otro, ni reservando los dos a la vez', async () => {
    const pisa = await reservar({ inicio: `${JUEVES}T10:30`, clienteId: null, clienteNombre: 'Juan' }).expect(409);
    expect(pisa.body.message).toContain('10:00');
    // Pegado al anterior sí entra.
    await reservar({ inicio: `${JUEVES}T10:45`, clienteId: null, clienteNombre: 'Juan', duracionMin: 30 }).expect(201);
    // Dos a la vez por el mismo horario: entra uno solo.
    const [a, b] = await Promise.all([
      reservar({ inicio: `${JUEVES}T16:00`, clienteId: null, clienteNombre: 'Ana' }),
      reservar({ inicio: `${JUEVES}T16:15`, clienteId: null, clienteNombre: 'Beto' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  it('fuera de horario o día cerrado no entra, salvo que se fuerce', async () => {
    expect((await reservar({ inicio: `${JUEVES}T13:00` }).expect(400)).body.message).toContain('fuera');
    expect((await reservar({ inicio: '2030-01-04T10:00' }).expect(400)).body.message).toContain('fuera');
    await reservar({ inicio: `${JUEVES}T13:00`, forzar: true, duracionMin: 30 }).expect(201);
    const bloqueo = (await api().post('/agenda/bloqueos').set(DUENO).send({ fecha: '2030-01-10', motivo: 'Feriado' }).expect(201)).body.id;
    expect((await reservar({ inicio: '2030-01-10T10:00' }).expect(400)).body.message).toContain('cerrado');
    expect((await api().get('/agenda/libres').query({ recursoId: sofi, fecha: '2030-01-10' }).set(VENDEDOR).expect(200)).body.libres).toEqual([]);
    expect((await api().get('/agenda/bloqueos').query({ desde: '2030-01-01', hasta: '2030-01-31' }).set(VENDEDOR).expect(200)).body).toEqual([{ id: bloqueo, recursoId: null, fecha: '2030-01-10', motivo: 'Feriado' }]);
  });

  it('horarios libres: sin los ocupados y con la duración del servicio', async () => {
    const r = await api().get('/agenda/libres').query({ recursoId: sofi, fecha: JUEVES, servicioId: corte }).set(VENDEDOR).expect(200);
    expect(r.body.duracionMin).toBe(45);
    expect(r.body.libres).toContain('09:00');
    expect(r.body.libres).not.toContain('10:00');
    expect(r.body.libres).not.toContain('09:30'); // 09:30 + 45 pisa el de las 10
    expect(r.body.libres).toContain('11:15');
    expect(r.body.libres).not.toContain('11:30'); // termina 12:15, fuera de horario
  });

  it('reprogramar respeta los otros turnos; cancelado libera el horario', async () => {
    await api().patch(`/agenda/turnos/${turno}`).set(VENDEDOR).send({ inicio: `${JUEVES}T10:30` }).expect(409);
    const r = await api().patch(`/agenda/turnos/${turno}`).set(VENDEDOR).send({ inicio: `${JUEVES}T09:00` }).expect(200);
    expect(r.body.fin).toBe(`${JUEVES}T09:45`);
    await api().post(`/agenda/turnos/${turno}/estado`).set(VENDEDOR).send({ estado: 'cancelado' }).expect(201);
    const otro = (await reservar({ inicio: `${JUEVES}T09:00`, clienteId: null, clienteNombre: 'Caro' }).expect(201)).body.id;
    // Volver a reservarlo ya no se puede: el horario lo tomó otro.
    await api().post(`/agenda/turnos/${turno}/estado`).set(VENDEDOR).send({ estado: 'reservado' }).expect(409);
    await api().post(`/agenda/turnos/${otro}/estado`).set(VENDEDOR).send({ estado: 'no_vino' }).expect(201);
    await api().post(`/agenda/turnos/${turno}/estado`).set(VENDEDOR).send({ estado: 'confirmado' }).expect(201);
  });

  it('el recordatorio arma el WhatsApp y lo marca como recordado', async () => {
    const r = await api().post(`/agenda/turnos/${turno}/recordatorio`).set(VENDEDOR).expect(201);
    expect(r.body.mensaje).toContain('Hola Laura! Te recordamos tu turno de Corte con Sofi el jueves 03/01 a las 09:00');
    expect(r.body.whatsapp).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    const [t] = (await api().get('/agenda/turnos').query({ desde: JUEVES, hasta: JUEVES }).set(VENDEDOR).expect(200)).body.filter((x: { id: string }) => x.id === turno);
    expect(t.recordadoEn).not.toBeNull();
  });

  it('cobrado: queda atendido con su venta y ya no cambia de estado', async () => {
    const venta = (await api().post('/ventas').set(VENDEDOR).send({ items: [{ productoId: corte, cantidad: 1, precioUnitario: 12_000 }], formaPago: 'efectivo', clienteId: cliente }).expect(201)).body.id;
    const r = await api().post(`/agenda/turnos/${turno}/cobrado`).set(VENDEDOR).send({ ventaId: venta }).expect(201);
    expect(r.body).toMatchObject({ estado: 'atendido', ventaId: venta });
    await api().post(`/agenda/turnos/${turno}/estado`).set(VENDEDOR).send({ estado: 'cancelado' }).expect(400);
  });

  it('no se borra un profesional con turnos por delante', async () => {
    expect((await api().delete(`/agenda/recursos/${sofi}`).set(DUENO).expect(400)).body.message).toContain('turnos por delante');
  });

  it('otra empresa no ve ni toca nada', async () => {
    expect((await api().get('/agenda/turnos').query({ desde: JUEVES, hasta: JUEVES }).set(OTRA).expect(200)).body).toEqual([]);
    expect((await api().get('/agenda/recursos').set(OTRA).expect(200)).body).toEqual([]);
    await api().post(`/agenda/turnos/${turno}/estado`).set(OTRA).send({ estado: 'cancelado' }).expect(404);
    await api().post('/agenda/turnos').set(OTRA).send({ recursoId: sofi, clienteNombre: 'X', inicio: `${JUEVES}T17:00` }).expect(400);
  });
});
