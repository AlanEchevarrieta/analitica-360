// Reserva online de turnos desde la tienda (módulo de servicios, pieza 3, parte 2): apagada por
// defecto, solo plan con agenda y tienda activa, solo profesionales marcados para la web,
// "con quien esté libre", anticipación y días máximos, sin pisarse y visible en la agenda interna.
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts agenda-online
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

const hoyAR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const masDias = (fecha: string, n: number) => new Date(Date.parse(`${fecha}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

describe.skipIf(!URL_E2E)('Reserva online de turnos (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const basica = randomUUID();
  const DUENO = { Authorization: `Bearer user_aod_${sufijo}|org_ao_${sufijo}` };
  const BASICO = { Authorization: `Bearer user_aob_${sufijo}|org_aob_${sufijo}` };
  const FECHA = masDias(hoyAR(), 2);
  let corte = '';
  let sofi = '';
  let lu = '';
  let interno = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    for (const [id, org, user, plan] of [
      [empresa, `org_ao_${sufijo}`, `user_aod_${sufijo}`, 'pro'],
      [basica, `org_aob_${sufijo}`, `user_aob_${sufijo}`, 'basico'],
    ] as const) {
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [id, `Estética ${org}`, org]);
      await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueña', $3, $4, 'dueno')`, [randomUUID(), id, `${user}@e2e.test`, user]);
      await suscripcionActiva(db, id, plan);
      await db.query(`INSERT INTO tiendas_config (id, empresa_id, subdominio, nombre, activa) VALUES ($1, $2, $3, 'Tienda', true)`, [randomUUID(), id, `turnos-${plan}-${sufijo}`]);
    }
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
    const api = () => request(app.getHttpServer());
    corte = (await api().post('/productos').set(DUENO).send({ nombre: 'Limpieza facial', precioVenta: 18_000, esServicio: true, modoPrecio: 'fijo', duracionMin: 60 }).expect(201)).body.id;
    const todaLaSemana = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ diaSemana: d, desde: '09:00', hasta: '12:00' }));
    sofi = (await api().post('/agenda/recursos').set(DUENO).send({ nombre: 'Sofi', horarios: todaLaSemana }).expect(201)).body.id;
    lu = (await api().post('/agenda/recursos').set(DUENO).send({ nombre: 'Lu', horarios: todaLaSemana }).expect(201)).body.id;
    interno = (await api().post('/agenda/recursos').set(DUENO).send({ nombre: 'Box interno', online: false, horarios: todaLaSemana }).expect(201)).body.id;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const api = () => request(app.getHttpServer());
  const sitio = (sub: string) => api().get('/tienda-sitio').query({ host: `${sub}.analitica360.app` });
  const reservar = (body: Record<string, unknown>) => api().post(`/tienda/${empresa}/turnos`).send({ servicioId: corte, fecha: FECHA, nombre: 'Laura Pérez', telefono: '2615551234', ...body });

  it('arranca apagada: la tienda no ofrece turnos', async () => {
    expect((await api().get(`/tienda/${empresa}/turnos`).expect(200)).body).toEqual({ activa: false });
    expect((await sitio(`turnos-pro-${sufijo}`).expect(200)).body.turnosOnline).toBe(false);
    await api().get(`/tienda/${empresa}/turnos/libres`).query({ fecha: FECHA, servicioId: corte }).expect(404);
  });

  it('el dueño la prende; sin el plan con agenda no se ofrece igual', async () => {
    const c = await api().put('/agenda/config').set(DUENO).send({ reservaOnline: true, anticipacionMin: 120, diasMaximo: 14, mensaje: 'Llegá 5 minutos antes' }).expect(200);
    expect(c.body).toMatchObject({ reservaOnline: true, diasMaximo: 14 });
    expect((await sitio(`turnos-pro-${sufijo}`).expect(200)).body.turnosOnline).toBe(true);
    await api().put('/agenda/config').set(BASICO).send({ reservaOnline: true, anticipacionMin: 0, diasMaximo: 30 }).expect(403);
    await db.query(`INSERT INTO agenda_config (empresa_id, reserva_online) VALUES ($1, true)`, [basica]);
    expect((await api().get(`/tienda/${basica}/turnos`).expect(200)).body).toEqual({ activa: false });
  });

  it('muestra los servicios y solo los profesionales que atienden online', async () => {
    const r = await api().get(`/tienda/${empresa}/turnos`).expect(200);
    expect(r.body).toMatchObject({ activa: true, diasMaximo: 14, mensaje: 'Llegá 5 minutos antes' });
    expect(r.body.servicios).toEqual([expect.objectContaining({ id: corte, nombre: 'Limpieza facial', duracionMin: 60, precio: 18000 })]);
    expect(r.body.profesionales.map((p: { nombre: string }) => p.nombre)).toEqual(['Sofi', 'Lu']);
  });

  it('horarios libres de cualquiera, con quiénes los tienen', async () => {
    const r = await api().get(`/tienda/${empresa}/turnos/libres`).query({ fecha: FECHA, servicioId: corte }).expect(200);
    expect(r.body.libres.map((l: { hora: string }) => l.hora)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00']);
    expect(r.body.libres[0].profesionales.sort()).toEqual([sofi, lu].sort());
    expect(r.body.libres[0].profesionales).not.toContain(interno);
    await api().get(`/tienda/${empresa}/turnos/libres`).query({ fecha: masDias(hoyAR(), 20), servicioId: corte }).expect(400);
    await api().get(`/tienda/${empresa}/turnos/libres`).query({ fecha: FECHA, servicioId: corte, recursoId: interno }).expect(400);
  });

  it('"con quien esté libre": el mismo horario va a una y después a la otra; el tercero no entra', async () => {
    const a = await reservar({ hora: '10:00' }).expect(201);
    const b = await reservar({ hora: '10:00', nombre: 'Juan' }).expect(201);
    expect([a.body.profesional, b.body.profesional].sort()).toEqual(['Lu', 'Sofi']);
    expect(a.body.cuando).toMatch(/a las 10:00$/);
    expect(a.body.mensaje).toBe('Llegá 5 minutos antes');
    await reservar({ hora: '10:30', nombre: 'Caro' }).expect(409);
    const libres = (await api().get(`/tienda/${empresa}/turnos/libres`).query({ fecha: FECHA, servicioId: corte }).expect(200)).body.libres.map((l: { hora: string }) => l.hora);
    expect(libres).toEqual(['09:00', '11:00']);
  });

  it('respeta la anticipación mínima', async () => {
    await api().put('/agenda/config').set(DUENO).send({ reservaOnline: true, anticipacionMin: 7 * 24 * 60, diasMaximo: 14 }).expect(200);
    expect((await reservar({ hora: '11:00' }).expect(400)).body.message).toContain('anticipación');
    await api().put('/agenda/config').set(DUENO).send({ reservaOnline: true, anticipacionMin: 120, diasMaximo: 14 }).expect(200);
  });

  it('queda en la agenda interna como reserva online', async () => {
    const turnos = (await api().get('/agenda/turnos').query({ desde: FECHA, hasta: FECHA }).set(DUENO).expect(200)).body;
    expect(turnos).toHaveLength(2);
    expect(turnos[0]).toMatchObject({ origen: 'online', servicio: 'Limpieza facial', clienteTelefono: '2615551234', estado: 'reservado' });
  });
});
