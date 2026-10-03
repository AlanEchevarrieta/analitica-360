// Aislamiento entre empresas (AppModule completo, guards reales): una empresa
// no puede ver, cambiar ni borrar nada de otra aunque conozca los ids.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts aislamiento
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const URL_E2E = process.env.E2E_DATABASE_URL;

vi.mock('@clerk/backend', async (original) => ({
  ...(await original<typeof import('@clerk/backend')>()),
  verifyToken: async (token: string) => {
    const [sub, org] = token.split('|');
    return { sub, o: org ? { id: org } : undefined };
  },
}));

describe.skipIf(!URL_E2E)('Aislamiento entre empresas (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const OTRA = { Authorization: `Bearer user_iso_b_${sufijo}|org_iso_b_${sufijo}` };
  const DUENA = { Authorization: `Bearer user_iso_a_${sufijo}|org_iso_a_${sufijo}` };
  // Datos de la empresa A.
  const ids = { producto: randomUUID(), cliente: randomUUID(), proveedor: randomUUID(), venta: randomUUID(), pedido: randomUUID(), compra: randomUUID(), usuario: randomUUID() };

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const empresas: Record<string, string> = {};
    for (const letra of ['a', 'b']) {
      const empresa = (empresas[letra] = randomUUID());
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `Iso ${letra} ${sufijo}`, `org_iso_${letra}_${sufijo}`]);
      await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueño', $3, $4, 'dueno')`, [
        letra === 'a' ? ids.usuario : randomUUID(),
        empresa,
        `iso_${letra}_${sufijo}@e2e.test`,
        `user_iso_${letra}_${sufijo}`,
      ]);
      await db.query(`INSERT INTO suscripciones (id, empresa_id, estado, fecha_vencimiento) VALUES ($1, $2, 'activa', '2099-01-01')`, [randomUUID(), empresa]);
    }
    const a = empresas.a;
    await db.query(`INSERT INTO productos (id, empresa_id, nombre, precio_venta, costo) VALUES ($1, $2, 'Secreto A', 1000, 500)`, [ids.producto, a]);
    await db.query(`INSERT INTO clientes (id, empresa_id, nombre) VALUES ($1, $2, 'Cliente A')`, [ids.cliente, a]);
    await db.query(`INSERT INTO proveedores (id, empresa_id, nombre) VALUES ($1, $2, 'Proveedor A')`, [ids.proveedor, a]);
    await db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, forma_pago) VALUES ($1, $2, $3, 'efectivo')`, [ids.venta, a, ids.usuario]);
    await db.query(`INSERT INTO pedidos (id, empresa_id, numero_pedido) VALUES ($1, $2, $3)`, [ids.pedido, a, `P-ISO-${sufijo}`]);
    await db.query(`INSERT INTO compras (id, empresa_id) VALUES ($1, $2)`, [ids.compra, a]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('la dueña sí ve sus datos (el test mira lo correcto)', async () => {
    await request(app.getHttpServer()).get(`/productos/${ids.producto}`).set(DUENA).expect(200);
    await request(app.getHttpServer()).get(`/clientes/${ids.cliente}`).set(DUENA).expect(200);
  });

  it.each([
    ['producto', () => `/productos/${ids.producto}`],
    ['kardex', () => `/productos/${ids.producto}/movimientos`],
    ['variantes', () => `/productos/${ids.producto}/variantes`],
    ['cliente', () => `/clientes/${ids.cliente}`],
    ['proveedor', () => `/proveedores/${ids.proveedor}`],
    ['venta', () => `/ventas/${ids.venta}`],
    ['pedido', () => `/pedidos/${ids.pedido}`],
    ['compra', () => `/compras/${ids.compra}`],
  ])('otra empresa no puede ver el %s de A', async (_nombre, ruta) => {
    const r = await request(app.getHttpServer()).get(ruta()).set(OTRA);
    expect([403, 404]).toContain(r.status);
    expect(JSON.stringify(r.body)).not.toMatch(/Secreto A|Cliente A|Proveedor A/);
  });

  it('otra empresa no puede cambiar ni anular nada de A', async () => {
    const s = app.getHttpServer();
    const intentos = await Promise.all([
      request(s).patch(`/productos/${ids.producto}`).set(OTRA).send({ nombre: 'Hackeado', precioVenta: 1 }),
      request(s).patch(`/clientes/${ids.cliente}`).set(OTRA).send({ nombre: 'Hackeado' }),
      request(s).patch(`/proveedores/${ids.proveedor}`).set(OTRA).send({ nombre: 'Hackeado' }),
      request(s).post(`/ventas/${ids.venta}/anular`).set(OTRA).send({ motivo: 'x' }),
      request(s).post(`/pedidos/${ids.pedido}/cancelar`).set(OTRA).send({ motivo: 'x' }),
      request(s).post(`/compras/${ids.compra}/anular`).set(OTRA).send({ motivo: 'x' }),
    ]);
    for (const r of intentos) expect(r.status, `${r.req.method} ${r.req.path} → ${r.status}`).toBeGreaterThanOrEqual(400);
    const p = (await db.query(`SELECT nombre, precio_venta::float AS precio FROM productos WHERE id = $1`, [ids.producto])).rows[0];
    expect(p).toEqual({ nombre: 'Secreto A', precio: 1000 });
    expect((await db.query(`SELECT nombre FROM clientes WHERE id = $1`, [ids.cliente])).rows[0].nombre).toBe('Cliente A');
    expect((await db.query(`SELECT nombre FROM proveedores WHERE id = $1`, [ids.proveedor])).rows[0].nombre).toBe('Proveedor A');
    expect((await db.query(`SELECT count(*)::int AS n FROM anulaciones WHERE venta_id = $1`, [ids.venta])).rows[0].n).toBe(0);
  });

  it('los listados de la otra empresa no traen nada de A', async () => {
    const s = app.getHttpServer();
    for (const ruta of ['/productos', '/clientes', '/proveedores', '/ventas', '/pedidos', '/compras', '/inventario/movimientos?desde=2000-01-01&hasta=2099-01-01']) {
      const r = await request(s).get(ruta).set(OTRA).expect(200);
      expect(JSON.stringify(r.body), ruta).not.toMatch(/Secreto A|Cliente A|Proveedor A/);
    }
  });

  it('un cliente común no entra a la consola de administración', async () => {
    const s = app.getHttpServer();
    for (const ruta of ['/admin/metrics', '/admin/empresas', '/admin/pagos', '/admin/uso', '/admin/alianzas/camaras']) {
      await request(s).get(ruta).set(OTRA).expect(403);
    }
  });

  it('sin sesión no entra a nada', async () => {
    await request(app.getHttpServer()).get('/productos').expect(401);
    await request(app.getHttpServer()).get('/productos').set({ Authorization: 'Bearer ' }).expect(401);
  });
});
