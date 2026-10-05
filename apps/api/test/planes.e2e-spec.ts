// Planes de punta a punta (AppModule completo, guards reales): cada plan solo
// puede usar lo que incluye, aunque se llame a la API a mano; la prueba gratis
// es Pro; las demo, todo; y se aplican los límites de usuarios y ubicaciones.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts planes
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

describe.skipIf(!URL_E2E)('Planes (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresas: Record<string, string> = {};
  const dueno = (k: string) => ({ Authorization: `Bearer user_pl_${k}_${sufijo}|org_pl_${k}_${sufijo}` });
  const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const s = () => app.getHttpServer();

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    for (const k of ['basico', 'pro', 'ecommerce', 'prueba', 'demo']) {
      const id = (empresas[k] = randomUUID());
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id, es_demo) VALUES ($1, $2, $3, $4)`, [id, `Plan ${k} ${sufijo}`, `org_pl_${k}_${sufijo}`, k === 'demo']);
      await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol, created_at) VALUES ($1, $2, 'Dueño', $3, $4, 'dueno', now() - interval '1 day')`, [randomUUID(), id, `pl_${k}_${sufijo}@e2e.test`, `user_pl_${k}_${sufijo}`]);
      await db.query(`INSERT INTO tiendas_config (id, empresa_id, subdominio, nombre, activa) VALUES ($1, $2, $3, 'Tienda', true)`, [randomUUID(), id, `pl-${k}-${sufijo}`]);
    }
    await suscripcionActiva(db, empresas.basico, 'basico');
    await suscripcionActiva(db, empresas.pro, 'pro');
    await suscripcionActiva(db, empresas.ecommerce, 'ecommerce');
    // Prueba gratis vigente (sin plan contratado).
    await db.query(`INSERT INTO suscripciones (id, empresa_id, estado, fecha_vencimiento) VALUES ($1, $2, 'periodo_prueba', '2099-01-01')`, [randomUUID(), empresas.prueba]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const estado = async (k: string, ruta: string) => (await request(s()).get(ruta).set(dueno(k))).status;
  const rango = `desde=${hoy}&hasta=${hoy}`;

  it('Básico: lo básico sí; analytics, listas, pedidos, auditoría y tienda no (y dice desde qué plan)', async () => {
    expect(await estado('basico', '/productos')).toBe(200);
    expect(await estado('basico', '/ventas')).toBe(200);
    expect(await estado('basico', '/inventario/movimientos?' + rango)).toBe(200);
    const r = await request(s()).get('/analytics/dashboard').set(dueno('basico')).expect(403);
    expect(r.body).toMatchObject({ code: 'plan_insuficiente', funcion: 'analytics', planMinimo: 'pro' });
    for (const ruta of ['/listas-precios', '/pedidos', '/cuenta-corriente', '/difusiones', `/auditoria?${rango}`, '/clientes/segmentos']) expect(await estado('basico', ruta), ruta).toBe(403);
    const t = await request(s()).get('/tienda-config').set(dueno('basico')).expect(403);
    expect(t.body).toMatchObject({ code: 'plan_insuficiente', planMinimo: 'ecommerce' });
  });

  it('Básico: la configuración y exportar sus datos siguen andando', async () => {
    expect(await estado('basico', '/configuracion')).toBe(200);
    expect(await estado('basico', '/import-export/exportar/ventas')).toBe(200);
    expect(await estado('basico', '/suscripcion')).toBe(200);
  });

  it('Pro: todo menos la tienda; su tienda pública no está publicada', async () => {
    for (const ruta of ['/analytics/dashboard', '/listas-precios', '/pedidos', '/cuenta-corriente', `/auditoria?${rango}`]) expect(await estado('pro', ruta), ruta).toBe(200);
    expect(await estado('pro', '/tienda-config')).toBe(403);
    await request(s()).get(`/tienda/${empresas.pro}/catalogo`).expect(404);
  });

  it('E-commerce: todo, y la tienda pública responde', async () => {
    expect(await estado('ecommerce', '/tienda-config')).toBe(200);
    expect(await estado('ecommerce', '/tienda-config/cupones')).toBe(200);
    await request(s()).get(`/tienda/${empresas.ecommerce}/catalogo`).expect(200);
  });

  it('prueba gratis = Pro (sin tienda); demo = todo', async () => {
    expect(await estado('prueba', '/analytics/dashboard')).toBe(200);
    expect(await estado('prueba', '/tienda-config')).toBe(403);
    expect(await estado('demo', '/tienda-config')).toBe(200);
  });

  it('GET /suscripcion le dice a la web qué incluye el plan', async () => {
    const r = await request(s()).get('/suscripcion').set(dueno('basico')).expect(200);
    expect(r.body.plan).toMatchObject({ id: 'basico', nombre: 'Básico', maxUsuarios: 2, maxUbicaciones: 2, usuarios: 1 });
    expect(r.body.plan.funciones).not.toContain('analytics');
  });

  it('Básico: hasta 2 ubicaciones', async () => {
    for (const nombre of ['Local', 'Depósito']) await request(s()).post('/ubicaciones').set(dueno('basico')).send({ nombre }).expect(201);
    const r = await request(s()).post('/ubicaciones').set(dueno('basico')).send({ nombre: 'Feria' }).expect(403);
    expect(r.body).toMatchObject({ code: 'plan_limite_ubicaciones' });
  });

  it('Básico: con 3 usuarios, el tercero (el más nuevo) no entra; el dueño sí', async () => {
    for (const n of [1, 2]) {
      await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol, created_at) VALUES ($1, $2, $3, $4, $5, 'operador', now() + ($6 || ' minutes')::interval)`, [
        randomUUID(),
        empresas.basico,
        `Empleado ${n}`,
        `pl_emp${n}_${sufijo}@e2e.test`,
        `user_pl_emp${n}_${sufijo}`,
        String(n),
      ]);
    }
    // El caché del plan dura unos segundos: la prueba usa usuarios que el guard todavía no vio.
    await new Promise((r) => setTimeout(r, 31_000));
    const empleado = (n: number) => ({ Authorization: `Bearer user_pl_emp${n}_${sufijo}|org_pl_basico_${sufijo}` });
    expect((await request(s()).get('/productos').set(empleado(1))).status).not.toBe(403);
    const r = await request(s()).get('/productos').set(empleado(2)).expect(403);
    expect(r.body).toMatchObject({ code: 'plan_limite_usuarios' });
    expect(await estado('basico', '/productos')).toBe(200);
  }, 60_000);
});
