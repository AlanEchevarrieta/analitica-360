// Servicios en el catálogo (módulo de servicios, pieza 1), de punta a punta: alta, filtros,
// venta sin stock (y con insumos por receta), devolución, reglas (no insumo, sin variantes,
// no pasar a servicio con stock), y que no aparezcan en stock bajo, tienda ni avisos.
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts servicios
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

describe.skipIf(!URL_E2E)('Servicios en el catálogo (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const dueno = randomUUID();
  const tintura = randomUUID();
  const DUENO = { Authorization: `Bearer user_svd_${sufijo}|org_sv_${sufijo}` };
  let corte = '';
  let color = '';
  let reparacion = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `Peluquería ${sufijo}`, `org_sv_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueña', $3, $4, 'dueno')`, [dueno, empresa, `svd_${sufijo}@e2e.test`, `user_svd_${sufijo}`]);
    await suscripcionActiva(db, empresa, 'ecommerce');
    // Insumo con 10 unidades: la tintura que consume el servicio de color.
    await db.query(`INSERT INTO productos (id, empresa_id, nombre, es_insumo, costo) VALUES ($1, $2, 'Tintura', true, 1500)`, [tintura, empresa]);
    await db.query(`INSERT INTO movimientos_inventario (id, empresa_id, producto_id, usuario_id, tipo, cantidad, signo, fecha) VALUES ($1, $2, $3, $4, 'ajuste_positivo', 10, 1, now())`, [randomUUID(), empresa, tintura, dueno]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const api = () => request(app.getHttpServer());
  const movimientos = async (productoId: string) => (await db.query(`SELECT cantidad::int, signo FROM movimientos_inventario WHERE empresa_id = $1 AND producto_id = $2 AND tipo <> 'ajuste_positivo' ORDER BY signo`, [empresa, productoId])).rows;
  const vender = (items: { productoId: string; cantidad: number; precioUnitario: number }[]) => api().post('/ventas').set(DUENO).send({ items, formaPago: 'efectivo' });

  it('se dan de alta con modo de precio y duración', async () => {
    const r = await api().post('/productos').set(DUENO).send({ nombre: 'Corte', precioVenta: 12_000, esServicio: true, modoPrecio: 'fijo', duracionMin: 45 }).expect(201);
    corte = r.body.id;
    expect(r.body).toMatchObject({ esServicio: true, modoPrecio: 'fijo', duracionMin: 45, esInsumo: false });
    color = (await api().post('/productos').set(DUENO).send({ nombre: 'Color', precioVenta: 30_000, costo: 0, esServicio: true, duracionMin: 90 }).expect(201)).body.id;
    reparacion = (await api().post('/productos').set(DUENO).send({ nombre: 'Reparación a medida', esServicio: true, modoPrecio: 'a_presupuestar' }).expect(201)).body.id;
    await api().put('/produccion/receta').set(DUENO).send({ productoId: color, armarAlVender: true, items: [{ insumoId: tintura, cantidad: 2 }] }).expect(200);
  });

  it('no puede ser insumo, no lleva variantes y la duración se controla', async () => {
    await api().post('/productos').set(DUENO).send({ nombre: 'X', esServicio: true, esInsumo: true }).expect(400);
    await api().post('/productos').set(DUENO).send({ nombre: 'X', esServicio: true, duracionMin: 2 }).expect(400);
    const r = await api().put(`/productos/${corte}/variantes`).set(DUENO).send({ variantes: [{ atributos: { Largo: 'Corto' }, activo: true }] });
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('no lleva variantes');
  });

  it('un producto con stock no pasa a servicio', async () => {
    const r = await api().patch(`/productos/${tintura}`).set(DUENO).send({ nombre: 'Tintura', esInsumo: false, esServicio: true });
    expect([400]).toContain(r.status);
    expect(r.body.message).toContain('stock');
  });

  it('los filtros separan servicios, mercadería y lo que tiene stock', async () => {
    const nombres = async (tipo: string) => (await api().get(`/productos?tipo=${tipo}&pageSize=50`).set(DUENO).expect(200)).body.items.map((p: { nombre: string }) => p.nombre).sort();
    expect(await nombres('servicios')).toEqual(['Color', 'Corte', 'Reparación a medida']);
    expect(await nombres('stock')).toEqual(['Tintura']);
    expect(await nombres('mercaderia')).toEqual([]);
    expect(await nombres('venta')).toEqual(['Color', 'Corte', 'Reparación a medida']);
  });

  it('vender un servicio no mueve stock; con receta descuenta sus insumos; a presupuestar lleva el precio escrito', async () => {
    const v = await vender([
      { productoId: corte, cantidad: 1, precioUnitario: 12_000 },
      { productoId: color, cantidad: 2, precioUnitario: 30_000 },
      { productoId: reparacion, cantidad: 1, precioUnitario: 45_000 },
    ]).expect(201);
    expect(v.body.total).toBe(117_000);
    expect(await movimientos(corte)).toEqual([]);
    expect(await movimientos(reparacion)).toEqual([]);
    expect(await movimientos(color)).toEqual([]);
    expect(await movimientos(tintura)).toEqual([{ cantidad: 4, signo: -1 }]);
    // Al anular, vuelve solo lo que salió (la tintura).
    await api().post(`/ventas/${v.body.id}/anular`).set(DUENO).send({ motivo: 'prueba' }).expect(201);
    expect(await movimientos(tintura)).toEqual([{ cantidad: 4, signo: -1 }, { cantidad: 4, signo: 1 }]);
    expect(await movimientos(corte)).toEqual([]);
  });

  it('no aparecen en stock bajo ni en la tienda, y el presupuesto no avisa faltante', async () => {
    const inicio = await api().get('/analytics/dashboard').set(DUENO).expect(200);
    // En "más vendidos" sí aparecen; en el stock y sus alertas, no.
    expect(inicio.body.stock.map((s: { nombre: string }) => s.nombre)).toEqual(['Tintura']);
    expect(inicio.body.alertasStock).toEqual([]);
    const cat = await api().get(`/tienda/${empresa}/catalogo`);
    if (cat.status === 200) expect(JSON.stringify(cat.body)).not.toContain('Corte');
    const p = await api().post('/presupuestos').set(DUENO).send({ items: [{ productoId: corte, cantidad: 3, precioUnitario: 12_000 }], descuento: 0 }).expect(201);
    const ficha = await api().get(`/presupuestos/${p.body.id}`).set(DUENO).expect(200);
    expect(ficha.body.items[0].stock).toBeNull();
  });
});
