// Descuentos de la tienda online de punta a punta (AppModule completo, guards
// reales): el dueño carga una oferta, un cupón y el % por transferencia desde la
// app; el catálogo público los muestra; el pedido los calcula en el servidor; el
// límite de usos aguanta compras simultáneas; y la venta del despacho registra
// lo que realmente se cobró.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts descuentos
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

describe.skipIf(!URL_E2E)('Descuentos de la tienda online (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const DUENO = { Authorization: `Bearer user_desc_${sufijo}|org_desc_${sufijo}` };
  const EMPLEADO = { Authorization: `Bearer user_desc_op_${sufijo}|org_desc_${sufijo}` };
  const empresa = randomUUID();
  const mate = randomUUID();
  const bolso = randomUUID();
  const cliente = { clienteNombre: 'Ana', clienteEmail: 'ana@example.com', clienteTelefono: '2615555555', direccionEnvio: 'San Martín 100', codigoPostal: '5500', localidad: 'Mendoza', provincia: 'Mendoza' };
  const s = () => app.getHttpServer();
  // Cada pedido simula un cliente distinto (el límite de pedidos por minuto es por IP).
  let ip = 1;
  const publico = () => ({ 'x-forwarded-for': `10.0.0.${ip++}` });

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `Desc ${sufijo}`, `org_desc_${sufijo}`]);
    await suscripcionActiva(db, empresa);
    const duena = randomUUID();
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueña', $3, $4, 'dueno')`, [duena, empresa, `desc_${sufijo}@e2e.test`, `user_desc_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Empleado', $3, $4, 'operador')`, [randomUUID(), empresa, `desc_op_${sufijo}@e2e.test`, `user_desc_op_${sufijo}`]);
    await db.query(`INSERT INTO tiendas_config (id, empresa_id, subdominio, nombre, activa) VALUES ($1, $2, $3, 'Tienda', true)`, [randomUUID(), empresa, `desc-${sufijo}`]);
    await db.query(`INSERT INTO productos (id, empresa_id, nombre, precio_venta, costo, en_tienda) VALUES ($1, $3, 'Mate Imperial', 15000, 6000, true), ($2, $3, 'Bolso Matero', 49000, 22000, true)`, [mate, bolso, empresa]);
    // Stock para poder despachar.
    for (const p of [mate, bolso]) {
      await db.query(`INSERT INTO movimientos_inventario (id, empresa_id, producto_id, usuario_id, tipo, cantidad, signo, fecha) VALUES ($1, $2, $3, $4, 'ajuste_positivo', 50, 1, now())`, [randomUUID(), empresa, p, duena]);
    }
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('el dueño carga una oferta del 20% y se ve en el catálogo con el precio tachado', async () => {
    const r = await request(s()).put(`/productos/${mate}/oferta`).set(DUENO).send({ tipo: 'porcentaje', valor: 20 }).expect(200);
    expect(r.body.oferta).toMatchObject({ tipo: 'porcentaje', valor: 20, estado: 'vigente', precioFinal: 12000, descuentoPct: 20 });
    const cat = await request(s()).get(`/tienda/${empresa}/catalogo`).set(publico()).expect(200);
    expect(cat.body.find((p: { id: string }) => p.id === mate)).toMatchObject({ precio: 12000, precioLista: 15000, descuentoPct: 20 });
    expect(cat.body.find((p: { id: string }) => p.id === bolso)).toMatchObject({ precio: 49000, precioLista: 49000, descuentoPct: 0 });
  });

  it('ofertas inválidas: precio que no baja, porcentaje de 100 o fechas al revés', async () => {
    await request(s()).put(`/productos/${bolso}/oferta`).set(DUENO).send({ tipo: 'precio', valor: 50000 }).expect(400);
    await request(s()).put(`/productos/${bolso}/oferta`).set(DUENO).send({ tipo: 'porcentaje', valor: 100 }).expect(400);
    await request(s()).put(`/productos/${bolso}/oferta`).set(DUENO).send({ tipo: 'porcentaje', valor: 10, desde: '2026-12-10', hasta: '2026-12-01' }).expect(400);
  });

  it('una oferta programada para el futuro todavía no cambia el precio', async () => {
    await request(s()).put(`/productos/${bolso}/oferta`).set(DUENO).send({ tipo: 'precio', valor: 39900, desde: '2099-01-01' }).expect(200);
    const cat = await request(s()).get(`/tienda/${empresa}/catalogo`).set(publico()).expect(200);
    expect(cat.body.find((p: { id: string }) => p.id === bolso).precio).toBe(49000);
    await request(s()).delete(`/productos/${bolso}/oferta`).set(DUENO).expect(200);
  });

  it('cupones: el dueño los crea, el empleado solo los ve, y no se repiten', async () => {
    await request(s()).post('/tienda-config/cupones').set(EMPLEADO).send({ codigo: 'X', tipo: 'monto', valor: 1 }).expect(403);
    const r = await request(s()).post('/tienda-config/cupones').set(DUENO).send({ codigo: ' acacia 10 ', tipo: 'porcentaje', valor: 10, compraMinima: 20000 }).expect(201);
    expect(r.body[0]).toMatchObject({ codigo: 'ACACIA10', estado: 'vigente', usos: 0 });
    await request(s()).post('/tienda-config/cupones').set(DUENO).send({ codigo: 'ACACIA10', tipo: 'monto', valor: 1000 }).expect(409);
    await request(s()).post('/tienda-config/cupones').set(DUENO).send({ codigo: 'UNICO', tipo: 'monto', valor: 5000, usosMax: 1 }).expect(201);
    await request(s()).get('/tienda-config/cupones').set(EMPLEADO).expect(200);
  });

  it('el % por transferencia se configura y la tienda lo lee en las condiciones', async () => {
    const actual = (await request(s()).get('/tienda-config').set(DUENO).expect(200)).body;
    await request(s()).put('/tienda-config').set(DUENO).send({ ...actual, descuentoTransferencia: 10 }).expect(200);
    const c = await request(s()).get(`/tienda/${empresa}/condiciones`).set(publico()).expect(200);
    expect(c.body).toEqual({ pedidoMinimo: null, descuentoTransferencia: 10 });
  });

  it('validar cupón: explica por qué no vale y cuánto descuenta', async () => {
    const corto = await request(s()).post(`/tienda/${empresa}/cupones/validar`).set(publico()).send({ codigo: 'acacia10', subtotal: 12000 }).expect(201);
    expect(corto.body).toMatchObject({ valido: false, mensaje: expect.stringMatching(/compras desde/) });
    const ok = await request(s()).post(`/tienda/${empresa}/cupones/validar`).set(publico()).send({ codigo: 'acacia10', subtotal: 61000 }).expect(201);
    expect(ok.body).toEqual({ valido: true, codigo: 'ACACIA10', descuento: 6100 });
    const no = await request(s()).post(`/tienda/${empresa}/cupones/validar`).set(publico()).send({ codigo: 'NOEXISTE', subtotal: 61000 }).expect(201);
    expect(no.body).toMatchObject({ valido: false, mensaje: 'Ese código no existe' });
  });

  let pedidoId: string;

  it('el pedido con oferta + cupón + transferencia lo calcula el servidor (aunque el cliente mande otra cosa)', async () => {
    const r = await request(s())
      .post(`/tienda/${empresa}/pedidos`)
      .set(publico())
      .send({ ...cliente, items: [{ productoId: mate, cantidad: 1 }, { productoId: bolso, cantidad: 1 }], cuponCodigo: 'acacia10', formaPago: 'transferencia', precio: 1, descuento: 999999 })
      .expect(201);
    // 12.000 (mate con 20% off) + 49.000 = 61.000 − 6.100 cupón = 54.900 − 5.490 transferencia = 49.410
    expect(r.body).toMatchObject({ subtotal: 61000, descuentoCupon: 6100, descuentoTransferencia: 5490, total: 49410 });
    pedidoId = r.body.id;
    const p = (await db.query(`SELECT cupon_codigo, descuento_ofertas::float, descuento_cupon::float, descuento_transferencia::float, forma_pago_tienda FROM pedidos WHERE id = $1`, [pedidoId])).rows[0];
    expect(p).toEqual({ cupon_codigo: 'ACACIA10', descuento_ofertas: 3000, descuento_cupon: 6100, descuento_transferencia: 5490, forma_pago_tienda: 'transferencia' });
    const items = (await db.query(`SELECT producto_id, precio_unitario::float AS precio FROM pedidos_items WHERE pedido_id = $1 ORDER BY precio_unitario`, [pedidoId])).rows;
    expect(items).toEqual([{ producto_id: mate, precio: 12000 }, { producto_id: bolso, precio: 49000 }]);
    expect((await db.query(`SELECT usos FROM cupones_tienda WHERE empresa_id = $1 AND codigo = 'ACACIA10'`, [empresa])).rows[0].usos).toBe(1);
    // En la app, el pedido muestra lo que hay que cobrar y de dónde sale.
    const ficha = (await request(s()).get(`/pedidos/${pedidoId}`).set(DUENO).expect(200)).body;
    expect(ficha.total).toBe(49410);
    expect(ficha.descuentos).toEqual({ subtotal: 61000, ofertas: 3000, cuponCodigo: 'ACACIA10', cupon: 6100, transferencia: 5490, formaPagoTienda: 'transferencia' });
  });

  it('un cupón de un solo uso aguanta dos compras al mismo tiempo: una pasa, la otra no', async () => {
    const compra = () => request(s()).post(`/tienda/${empresa}/pedidos`).set(publico()).send({ ...cliente, items: [{ productoId: bolso, cantidad: 1 }], cuponCodigo: 'UNICO' });
    const [a, b] = await Promise.all([compra(), compra()]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    expect((a.status === 400 ? a : b).body.message).toMatch(/todas las veces/);
    expect((await db.query(`SELECT usos FROM cupones_tienda WHERE empresa_id = $1 AND codigo = 'UNICO'`, [empresa])).rows[0].usos).toBe(1);
  });

  it('al despachar, la venta registra el descuento de cupón + transferencia y el total cobrado', async () => {
    await request(s()).post(`/pedidos/${pedidoId}/marcar-todo-preparado`).set(DUENO).expect((r) => expect(r.status).toBeLessThan(300));
    await request(s()).post(`/pedidos/${pedidoId}/confirmar-listo-despacho`).set(DUENO).expect((r) => expect(r.status).toBeLessThan(300));
    await request(s()).post(`/pedidos/${pedidoId}/despacho`).set(DUENO).send({ formaPago: 'transferencia' }).expect((r) => expect(r.status).toBeLessThan(300));
    const v = (await db.query(`SELECT v.descuento::float, v.total_sin_interes::float AS total, v.notas FROM ventas v JOIN pedidos p ON p.venta_id = v.id WHERE p.id = $1`, [pedidoId])).rows[0];
    expect(v).toMatchObject({ descuento: 11590, total: 49410 });
    expect(v.notas).toMatch(/cupón ACACIA10.*transferencia/);
  });

  it('todo quedó en la bitácora: oferta, cupones y configuración', async () => {
    const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    const b = await request(s()).get(`/auditoria?desde=${hoy}&hasta=${hoy}`).set(DUENO).expect(200);
    const resumenes = b.body.items.map((i: { resumen: string }) => i.resumen).join('\n');
    expect(resumenes).toMatch(/editó producto «Mate Imperial»: oferta tipo/);
    expect(resumenes).toMatch(/creó cupón de la tienda «ACACIA10»/);
    expect(resumenes).toMatch(/descuento transferencia 0 → 10/);
  });
});
