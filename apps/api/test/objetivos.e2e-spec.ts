// Objetivos de punta a punta (AppModule completo, guards reales): facturación por
// empresa, sucursal y usuario, producción, despachos (cantidad, días y a tiempo),
// quién ve qué, quién puede crear y qué permite el plan Básico.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts objetivos
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

describe.skipIf(!URL_E2E)('Objetivos (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const dueno = randomUUID();
  const vendedor = randomUUID();
  const producto = randomUUID();
  const DUENO = { Authorization: `Bearer user_odue_${sufijo}|org_obj_${sufijo}` };
  const VENDEDOR = { Authorization: `Bearer user_oven_${sufijo}|org_obj_${sufijo}` };
  const empresaBasica = randomUUID();
  const BASICO = { Authorization: `Bearer user_obas_${sufijo}|org_obas_${sufijo}` };

  const venta = async (usuario: string, total: number, ubicacion: string | null, hace = '0 hours') => {
    const id = randomUUID();
    await db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, forma_pago, total_con_interes, fecha) VALUES ($1, $2, $3, 'efectivo', $4, now() - $5::interval)`, [id, empresa, usuario, total, hace]);
    if (ubicacion) {
      await db.query(`INSERT INTO movimientos_inventario (id, empresa_id, producto_id, usuario_id, tipo, cantidad, signo, ubicacion_origen, referencia_id) VALUES ($1, $2, $3, $4, 'venta', 1, -1, $5, $6)`, [randomUUID(), empresa, producto, usuario, ubicacion, id]);
    }
    return id;
  };

  const crear = (headers: Record<string, string>, body: Record<string, unknown>) => request(app.getHttpServer()).post('/objetivos').set(headers).send(body);

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `Objetivos ${sufijo}`, `org_obj_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueña', $3, $4, 'dueno')`, [dueno, empresa, `odue_${sufijo}@e2e.test`, `user_odue_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Vendedor', $3, $4, 'operador')`, [vendedor, empresa, `oven_${sufijo}@e2e.test`, `user_oven_${sufijo}`]);
    await suscripcionActiva(db, empresa, 'pro');
    await db.query(`INSERT INTO productos (id, empresa_id, nombre) VALUES ($1, $2, 'Mate')`, [producto, empresa]);
    for (const n of ['Local Centro', 'Feria', 'Taller']) await db.query(`INSERT INTO ubicaciones (id, empresa_id, nombre) VALUES ($1, $2, $3)`, [randomUUID(), empresa, n]);

    // Ventas de este mes: 100.000 de la dueña en el local y 50.000 del vendedor en la feria.
    await venta(dueno, 100_000, 'Local Centro');
    await venta(vendedor, 50_000, 'Feria');

    // Producción: 30 mates en el taller.
    const receta = randomUUID();
    await db.query(`INSERT INTO recetas (id, empresa_id, producto_id) VALUES ($1, $2, $3)`, [receta, empresa, producto]);
    await db.query(`INSERT INTO ordenes_produccion (id, empresa_id, numero, receta_id, producto_id, cantidad, costo_materiales, usuario_id, ubicacion) VALUES ($1, $2, 1, $3, $4, 30, 0, $5, 'Taller')`, [randomUUID(), empresa, receta, producto, dueno]);

    // Dos pedidos despachados hoy por el vendedor: uno a tiempo (2 días) y otro tarde (4 días).
    for (const [n, hace, comprometida] of [
      [1, '2 days', 'current_date'],
      [2, '4 days', 'current_date - 1'],
    ] as const) {
      const pedido = randomUUID();
      await db.query(`INSERT INTO pedidos (id, empresa_id, numero_pedido, created_at, fecha_comprometida) VALUES ($1, $2, $3, now() - $4::interval, ${comprometida})`, [pedido, empresa, `P-${sufijo}-${n}`, hace]);
      const v = await venta(vendedor, 0, null);
      await db.query(`UPDATE pedidos SET estado = 'despachado', venta_id = $2 WHERE id = $1`, [pedido, v]);
    }

    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresaBasica, `Obj básico ${sufijo}`, `org_obas_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueño', $3, $4, 'dueno')`, [randomUUID(), empresaBasica, `obas_${sufijo}@e2e.test`, `user_obas_${sufijo}`]);
    await suscripcionActiva(db, empresaBasica, 'basico');

    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const actual = async (headers: Record<string, string>) => {
    const r = await request(app.getHttpServer()).get('/objetivos').set(headers).expect(200);
    return r.body as { tipo: string; ubicacion: string | null; usuario: { id: string } | null; actual: { valor: number | null; porcentaje: number | null }; historial: unknown[] }[];
  };

  it('el dueño crea objetivos de la empresa, por sucursal, por usuario, de producción y de despachos', async () => {
    for (const body of [
      { tipo: 'facturacion', periodo: 'mes', meta: 300_000 },
      { tipo: 'facturacion', periodo: 'mes', meta: 200_000, ubicacion: 'Local Centro' },
      { tipo: 'facturacion', periodo: 'mes', meta: 100_000, usuarioId: vendedor },
      { tipo: 'ganancia', periodo: 'mes', meta: 100_000 },
      { tipo: 'produccion', periodo: 'mes', meta: 60, ubicacion: 'Taller', productoId: producto },
      { tipo: 'despachos', periodo: 'mes', meta: 4, usuarioId: vendedor },
      { tipo: 'dias_despacho', periodo: 'mes', meta: 2 },
      { tipo: 'a_tiempo', periodo: 'mes', meta: 90 },
    ]) {
      await crear(DUENO, body).expect(201);
    }
  });

  it('mide cada uno con los datos de su alcance', async () => {
    const lista = await actual(DUENO);
    const valor = (tipo: string, alcance: (o: (typeof lista)[number]) => boolean = (o) => !o.ubicacion && !o.usuario) => lista.find((o) => o.tipo === tipo && alcance(o))?.actual.valor;
    expect(valor('facturacion')).toBe(150_000);
    expect(valor('facturacion', (o) => o.ubicacion === 'Local Centro')).toBe(100_000);
    expect(valor('facturacion', (o) => o.usuario?.id === vendedor)).toBe(50_000);
    expect(valor('ganancia')).toBe(150_000);
    expect(valor('produccion', (o) => o.ubicacion === 'Taller')).toBe(30);
    expect(valor('despachos', (o) => o.usuario?.id === vendedor)).toBe(2);
    expect(valor('dias_despacho')).toBe(3);
    expect(valor('a_tiempo')).toBe(50);
    expect(lista[0].historial).toHaveLength(6);
  });

  it('el vendedor ve solo sus objetivos y no puede crear', async () => {
    const lista = await actual(VENDEDOR);
    expect(lista.length).toBe(2);
    expect(lista.every((o) => o.usuario?.id === vendedor)).toBe(true);
    await crear(VENDEDOR, { tipo: 'facturacion', periodo: 'mes', meta: 1 }).expect(403);
  });

  it('en Básico solo facturación de toda la empresa', async () => {
    await crear(BASICO, { tipo: 'facturacion', periodo: 'semana', meta: 50_000 }).expect(201);
    const r = await crear(BASICO, { tipo: 'ganancia', periodo: 'mes', meta: 1 }).expect(403);
    expect(r.body.code).toBe('plan_insuficiente');
  });

  it('la historia de estados del pedido se guarda sola', async () => {
    const { rows } = await db.query(`SELECT pe.estado FROM pedido_estados pe JOIN pedidos p ON p.id = pe.pedido_id WHERE p.numero_pedido = $1 ORDER BY pe.id`, [`P-${sufijo}-1`]);
    expect(rows.map((r) => r.estado)).toEqual(['nuevo', 'despachado']);
  });
});
