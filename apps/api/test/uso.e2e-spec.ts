// Uso de la app de punta a punta (AppModule completo, guards reales): la web
// manda pantallas y clics, y solo el administrador de la app ve el tablero.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts uso
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

describe.skipIf(!URL_E2E)('Uso de la app (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const ADMIN = { Authorization: `Bearer user_uadmin_${sufijo}|org_uadmin_${sufijo}` };
  const CLIENTE = { Authorization: `Bearer user_ucli_${sufijo}|org_ucli_${sufijo}` };
  const empresaCliente = randomUUID();
  const usuarioCliente = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const empresaAdmin = randomUUID();
    for (const [empresa, org, usuario, user, email] of [
      [empresaAdmin, `org_uadmin_${sufijo}`, randomUUID(), `user_uadmin_${sufijo}`, `uadmin_${sufijo}@e2e.test`],
      [empresaCliente, `org_ucli_${sufijo}`, usuarioCliente, `user_ucli_${sufijo}`, `ucli_${sufijo}@e2e.test`],
    ]) {
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `Uso ${org}`, org]);
      await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Persona', $3, $4, 'dueno')`, [usuario, empresa, email, user]);
      await suscripcionActiva(db, empresa);
    }
    await db.query(`INSERT INTO admin_emails (email) VALUES ($1)`, [`uadmin_${sufijo}@e2e.test`]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('la web manda un lote: se guarda sin ids en la ruta y sin texto en las vistas', async () => {
    await request(app.getHttpServer())
      .post('/uso/eventos')
      .set(CLIENTE)
      .send({
        sesion: `s-${sufijo}`,
        dispositivo: 'celular',
        eventos: [
          { tipo: 'vista', ruta: '/ventas', objetivo: 'ignorado' },
          { tipo: 'clic', ruta: '/ventas', objetivo: '  Nueva\n venta ' },
          { tipo: 'vista', ruta: '/ventas/3f2c1a9e-1b2c-4d5e-8f90-123456789abc?x=1' },
          { tipo: 'clic', ruta: '/ventas', objetivo: 'Nueva venta', en: Date.now() + 86_400_000 },
        ],
      })
      .expect(204);
    const filas = (await db.query(`SELECT tipo, ruta, objetivo, dispositivo, creado_en <= now() AS no_futuro FROM eventos_uso WHERE usuario_id = $1 ORDER BY id`, [usuarioCliente])).rows;
    expect(filas).toEqual([
      { tipo: 'vista', ruta: '/ventas', objetivo: null, dispositivo: 'celular', no_futuro: true },
      { tipo: 'clic', ruta: '/ventas', objetivo: 'Nueva venta', dispositivo: 'celular', no_futuro: true },
      { tipo: 'vista', ruta: '/ventas/:id', objetivo: null, dispositivo: 'celular', no_futuro: true },
      { tipo: 'clic', ruta: '/ventas', objetivo: 'Nueva venta', dispositivo: 'celular', no_futuro: true },
    ]);
  });

  it('lotes inválidos o demasiado grandes: 400', async () => {
    const vista = { tipo: 'vista', ruta: '/inicio' };
    await request(app.getHttpServer()).post('/uso/eventos').set(CLIENTE).send({ sesion: 'x', eventos: [] }).expect(400);
    await request(app.getHttpServer()).post('/uso/eventos').set(CLIENTE).send({ sesion: 'x', eventos: Array(51).fill(vista) }).expect(400);
    await request(app.getHttpServer()).post('/uso/eventos').set(CLIENTE).send({ sesion: 'x', eventos: [{ tipo: 'otro', ruta: '/' }] }).expect(400);
  });

  it('un cliente no puede ver el tablero: 403', async () => {
    await request(app.getHttpServer()).get('/admin/uso').set(CLIENTE).expect(403);
    await request(app.getHttpServer()).get(`/admin/uso/usuarios/${usuarioCliente}`).set(CLIENTE).expect(403);
  });

  it('el administrador ve quién, qué y cuántas veces; sus propios clics no cuentan salvo que lo pida', async () => {
    await request(app.getHttpServer()).post('/uso/eventos').set(ADMIN).send({ sesion: `a-${sufijo}`, eventos: [{ tipo: 'clic', ruta: '/ventas', objetivo: 'Nueva venta' }] }).expect(204);

    const r = await request(app.getHttpServer()).get(`/admin/uso?dias=7&empresaId=${empresaCliente}`).set(ADMIN).expect(200);
    expect(r.body.totales).toEqual({ usuarios: 1, empresas: 1, sesiones: 1, vistas: 2, clics: 2 });
    expect(r.body.clics).toEqual([{ objetivo: 'Nueva venta', ruta: '/ventas', veces: 2, usuarios: 1 }]);
    expect(r.body.usuarios[0]).toMatchObject({ id: usuarioCliente, vistas: 2, clics: 2, dias: 1, dispositivo: 'celular' });

    const general = await request(app.getHttpServer()).get('/admin/uso?dias=7').set(ADMIN).expect(200);
    expect(general.body.usuarios.some((u: { email: string }) => u.email === `uadmin_${sufijo}@e2e.test`)).toBe(false);
    const conAdmins = await request(app.getHttpServer()).get('/admin/uso?dias=7&conAdmins=true').set(ADMIN).expect(200);
    expect(conAdmins.body.usuarios.some((u: { email: string }) => u.email === `uadmin_${sufijo}@e2e.test`)).toBe(true);

    const u = await request(app.getHttpServer()).get(`/admin/uso/usuarios/${usuarioCliente}?dias=7`).set(ADMIN).expect(200);
    expect(u.body.usuario).toMatchObject({ email: `ucli_${sufijo}@e2e.test`, empresa: `Uso org_ucli_${sufijo}` });
    expect(u.body.recientes).toHaveLength(4);
  });

  it('período inválido: 400', async () => {
    await request(app.getHttpServer()).get('/admin/uso?dias=5').set(ADMIN).expect(400);
  });
});
