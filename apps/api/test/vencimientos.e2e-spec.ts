// Vencimientos de punta a punta (AppModule completo, guards reales): solo el
// administrador de la app ve el semáforo del dólar y los topes del monotributo.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts vencimientos
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

describe.skipIf(!URL_E2E)('Vencimientos (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const ADMIN = { Authorization: `Bearer user_vadm_${sufijo}|org_vadm_${sufijo}` };
  const CLIENTE = { Authorization: `Bearer user_vcli_${sufijo}|org_vcli_${sufijo}` };

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    for (const [org, user, email] of [
      [`org_vadm_${sufijo}`, `user_vadm_${sufijo}`, `vadm_${sufijo}@e2e.test`],
      [`org_vcli_${sufijo}`, `user_vcli_${sufijo}`, `vcli_${sufijo}@e2e.test`],
    ]) {
      const empresa = randomUUID();
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `Venc ${org}`, org]);
      await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Persona', $3, $4, 'dueno')`, [randomUUID(), empresa, email, user]);
      await suscripcionActiva(db, empresa);
    }
    await db.query(`INSERT INTO admin_emails (email) VALUES ($1)`, [`vadm_${sufijo}@e2e.test`]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('el administrador ve el semáforo del dólar y de los topes', async () => {
    const r = await request(app.getHttpServer()).get('/admin/vencimientos').set(ADMIN).expect(200);
    expect(r.body.map((v: { clave: string }) => v.clave)).toEqual(['dolar', 'topes_monotributo']);
    for (const v of r.body) expect(['ok', 'aviso', 'vencido']).toContain(v.estado);
  });

  it('un cliente común no lo ve', async () => {
    await request(app.getHttpServer()).get('/admin/vencimientos').set(CLIENTE).expect(403);
  });
});
