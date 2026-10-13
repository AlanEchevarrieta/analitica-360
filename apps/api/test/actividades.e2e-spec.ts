// Qué hace el negocio (productos, producción, servicios): se elige al registrarse, se lee y
// se cambia en Configuración (solo el dueño), y las empresas de antes quedan como estaban.
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts actividades
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const URL_E2E = process.env.E2E_DATABASE_URL;

// Token de prueba "<clerkUserId>|<clerkOrgId>" (org vacía = todavía sin empresa).
vi.mock('@clerk/backend', async (original) => ({
  ...(await original<typeof import('@clerk/backend')>()),
  verifyToken: async (token: string) => {
    const [sub, org] = token.split('|');
    return { sub, o: org ? { id: org } : undefined };
  },
}));

describe.skipIf(!URL_E2E)('Qué hace el negocio (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const bearer = (user: string, org = '') => ({ Authorization: `Bearer ${user}|${org}` });
  const vieja = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    // Una empresa de antes, sin configuración guardada.
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, 'Vieja', $2)`, [vieja, `org_vieja_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueño', $3, $4, 'dueno')`, [randomUUID(), vieja, `vieja_${sufijo}@e2e.test`, `user_vieja_${sufijo}`]);
    const { AppModule } = await import('../src/app.module.js');
    const { ClerkCuentasService } = await import('../src/modules/registro/clerk-cuentas.service.js');
    app = (
      await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(ClerkCuentasService)
        .useValue({
          usuario: async (id: string) => ({ email: `${id}@e2e.test`, nombre: 'Emprendedora' }),
          crearOrganizacion: async (_nombre: string, id: string) => `org_${id}`,
          bloquearCrearOrganizaciones: async () => {},
          borrarOrganizacion: async () => {},
        })
        .compile()
    ).createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const api = () => request(app.getHttpServer());
  const registrar = (user: string, extra: Record<string, unknown>) =>
    api().post('/registro').set(bearer(user)).send({ nombreNegocio: `Negocio ${user}`, rubro: 'peluqueria', telefono: '2615469432', aceptaTerminos: true, ...extra });

  it('una peluquería se registra con "doy servicios" y su configuración lo tiene', async () => {
    const user = `user_pelu_${sufijo}`;
    await registrar(user, { actividades: ['servicios', 'servicios'] }).expect(201);
    expect((await api().get('/configuracion').set(bearer(user, `org_${user}`)).expect(200)).body.actividades).toEqual(['servicios']);
  });

  it('puede elegir varias; sin ninguna no deja', async () => {
    const user = `user_mixto_${sufijo}`;
    await registrar(`user_nada_${sufijo}`, { actividades: [] }).expect(400);
    await registrar(user, { actividades: ['productos', 'produccion', 'servicios'] }).expect(201);
    expect((await api().get('/configuracion').set(bearer(user, `org_${user}`)).expect(200)).body.actividades).toEqual(['productos', 'produccion', 'servicios']);
  });

  it('si la web vieja no lo manda, queda como comercio de productos', async () => {
    const user = `user_sin_${sufijo}`;
    await registrar(user, {}).expect(201);
    expect((await api().get('/configuracion').set(bearer(user, `org_${user}`)).expect(200)).body.actividades).toEqual(['productos']);
  });

  it('las empresas de antes quedan con productos y producción, y el dueño lo cambia en Configuración', async () => {
    const DUENO = bearer(`user_vieja_${sufijo}`, `org_vieja_${sufijo}`);
    expect((await api().get('/configuracion').set(DUENO).expect(200)).body.actividades).toEqual(['productos', 'produccion']);
    await api().patch('/configuracion').set(DUENO).send({ actividades: [] }).expect(400);
    await api().patch('/configuracion').set(DUENO).send({ actividades: ['inventada'] }).expect(400);
    expect((await api().patch('/configuracion').set(DUENO).send({ actividades: ['productos', 'servicios'] }).expect(200)).body.actividades).toEqual(['productos', 'servicios']);
    expect((await api().get('/configuracion').set(DUENO).expect(200)).body.actividades).toEqual(['productos', 'servicios']);
  });
});
