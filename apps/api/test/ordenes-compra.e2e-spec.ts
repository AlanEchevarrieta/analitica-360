// Órdenes de compra de punta a punta: estados, edición (sin perder lo recibido),
// recepción en partes con ubicación de destino (stock, costo y compra) y cancelación.
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts ordenes-compra
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

describe.skipIf(!URL_E2E)('Órdenes de compra (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const mate = randomUUID();
  const bombilla = randomUUID();
  const proveedor = randomUUID();
  const DUENO = { Authorization: `Bearer user_ocd_${sufijo}|org_oc_${sufijo}` };
  let id = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `OC ${sufijo}`, `org_oc_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueña', $3, $4, 'dueno')`, [randomUUID(), empresa, `ocd_${sufijo}@e2e.test`, `user_ocd_${sufijo}`]);
    await suscripcionActiva(db, empresa, 'basico');
    await db.query(`INSERT INTO productos (id, empresa_id, nombre) VALUES ($1, $2, 'Mate'), ($3, $2, 'Bombilla')`, [mate, empresa, bombilla]);
    await db.query(`INSERT INTO proveedores (id, empresa_id, nombre) VALUES ($1, $2, 'Calabazas del Norte')`, [proveedor, empresa]);
    for (const n of ['Local', 'Depósito']) await db.query(`INSERT INTO ubicaciones (id, empresa_id, nombre) VALUES ($1, $2, $3)`, [randomUUID(), empresa, n]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const api = () => request(app.getHttpServer());
  const items = [
    { productoId: mate, cantidadPedida: 10, precioUnitario: 9000 },
    { productoId: bombilla, cantidadPedida: 20, precioUnitario: 2000 },
  ];

  it('se crea en borrador, se envía y se confirma; editarla mantiene el estado', async () => {
    const r = await api().post('/ordenes-compra').set(DUENO).send({ proveedorId: proveedor, items }).expect(201);
    id = r.body.id;
    expect(r.body).toMatchObject({ estado: 'borrador', total: 130_000 });
    await api().patch(`/ordenes-compra/${id}/estado`).set(DUENO).send({ estado: 'enviada' }).expect(200);
    await api().patch(`/ordenes-compra/${id}/estado`).set(DUENO).send({ estado: 'confirmada' }).expect(200);
    const e = await api().patch(`/ordenes-compra/${id}`).set(DUENO).send({ proveedorId: proveedor, notas: 'Urgente', items }).expect(200);
    expect(e.body).toMatchObject({ estado: 'confirmada', notas: 'Urgente' });
  });

  it('"recibida" no se marca a mano', async () => {
    await api().patch(`/ordenes-compra/${id}/estado`).set(DUENO).send({ estado: 'recibida' }).expect(400);
  });

  it('recibe una parte en el depósito: suma stock ahí y crea la compra', async () => {
    const ficha = (await api().get(`/ordenes-compra/${id}`).set(DUENO).expect(200)).body;
    const itemMate = ficha.items.find((i: { productoId: string }) => i.productoId === mate).id;
    await api().post(`/ordenes-compra/${id}/recepcion`).set(DUENO).send({ cantidades: { [itemMate]: 4 }, ubicacionDestino: 'Garage' }).expect(400);
    const r = await api().post(`/ordenes-compra/${id}/recepcion`).set(DUENO).send({ cantidades: { [itemMate]: 4 }, ubicacionDestino: 'Depósito' }).expect(201);
    expect(r.body.estado).toBe('recibida_parcial');
    const { rows } = await db.query(`SELECT cantidad::int, ubicacion_destino FROM movimientos_inventario WHERE empresa_id = $1 AND producto_id = $2`, [empresa, mate]);
    expect(rows).toEqual([{ cantidad: 4, ubicacion_destino: 'Depósito' }]);
    const compras = await db.query(`SELECT total::int FROM compras WHERE orden_compra_id = $1`, [id]);
    expect(compras.rows).toEqual([{ total: 36_000 }]);
  });

  it('con algo recibido ya no se edita (no se pierde lo que llegó) y solo se puede cancelar el resto', async () => {
    const r = await api().patch(`/ordenes-compra/${id}`).set(DUENO).send({ proveedorId: proveedor, items }).expect(400);
    expect(r.body.message).toContain('no se puede editar');
    await api().patch(`/ordenes-compra/${id}/estado`).set(DUENO).send({ estado: 'enviada' }).expect(400);
    await api().patch(`/ordenes-compra/${id}/estado`).set(DUENO).send({ estado: 'cancelada' }).expect(200);
    const ficha = (await api().get(`/ordenes-compra/${id}`).set(DUENO).expect(200)).body;
    expect(ficha.items.find((i: { productoId: string }) => i.productoId === mate).cantidadRecibida).toBe(4);
  });

  it('una orden cancelada no recibe mercadería', async () => {
    const ficha = (await api().get(`/ordenes-compra/${id}`).set(DUENO).expect(200)).body;
    const r = await api().post(`/ordenes-compra/${id}/recepcion`).set(DUENO).send({ cantidades: { [ficha.items[1].id]: 1 } }).expect(400);
    expect(r.body.message).toContain('cancelada');
  });
});
