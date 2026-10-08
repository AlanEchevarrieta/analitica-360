// Objetivos, segunda parte: tipos nuevos (unidades, ticket promedio, clientes nuevos y
// cobranza), devoluciones por sucursal y vendedor, metas propias por período y avisos.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts objetivos-mejoras
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

describe.skipIf(!URL_E2E)('Objetivos: tipos nuevos, metas por período y avisos (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const dueno = randomUUID();
  const vendedor = randomUUID();
  const producto = randomUUID();
  const DUENO = { Authorization: `Bearer user_mdue_${sufijo}|org_mej_${sufijo}` };
  const VENDEDOR = { Authorization: `Bearer user_mven_${sufijo}|org_mej_${sufijo}` };
  let finDeMes = '';
  let inicioDeMes = '';

  const venta = async (usuario: string, total: number, ubicacion: string, unidades: number, cliente: string | null, hace = '0 hours') => {
    const id = randomUUID();
    await db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, forma_pago, total_con_interes, cliente_id, fecha) VALUES ($1, $2, $3, 'efectivo', $4, $5, now() - $6::interval)`, [id, empresa, usuario, total, cliente, hace]);
    await db.query(`INSERT INTO ventas_items (id, empresa_id, venta_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4, $5, 20000)`, [randomUUID(), empresa, id, producto, unidades]);
    await db.query(`INSERT INTO movimientos_inventario (id, empresa_id, producto_id, usuario_id, tipo, cantidad, signo, ubicacion_origen, referencia_id) VALUES ($1, $2, $3, $4, 'venta', $5, -1, $6, $7)`, [randomUUID(), empresa, producto, usuario, unidades, ubicacion, id]);
    return id;
  };
  const crear = (body: Record<string, unknown>) => request(app.getHttpServer()).post('/objetivos').set(DUENO).send(body);
  const lista = async (headers = DUENO) => (await request(app.getHttpServer()).get('/objetivos').set(headers).expect(200)).body as { id: string; tipo: string; ubicacion: string | null; usuario: { id: string } | null; meta: number; actual: { valor: number | null; meta: number }; metasPeriodo: { desde: string; meta: number }[] }[];

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const { rows } = await db.query(`SELECT date_trunc('month', (now() AT TIME ZONE 'America/Argentina/Mendoza'))::date::text AS ini, (date_trunc('month', (now() AT TIME ZONE 'America/Argentina/Mendoza')) + interval '1 month - 1 day')::date::text AS fin`);
    inicioDeMes = rows[0].ini;
    finDeMes = rows[0].fin;
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `Mejoras ${sufijo}`, `org_mej_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueña', $3, $4, 'dueno')`, [dueno, empresa, `mdue_${sufijo}@e2e.test`, `user_mdue_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Vendedor', $3, $4, 'operador')`, [vendedor, empresa, `mven_${sufijo}@e2e.test`, `user_mven_${sufijo}`]);
    await suscripcionActiva(db, empresa, 'pro');
    await db.query(`INSERT INTO productos (id, empresa_id, nombre) VALUES ($1, $2, 'Mate')`, [producto, empresa]);
    for (const n of ['Feria', 'Local']) await db.query(`INSERT INTO ubicaciones (id, empresa_id, nombre) VALUES ($1, $2, $3)`, [randomUUID(), empresa, n]);
    const [nuevo, viejo] = [randomUUID(), randomUUID()];
    for (const [id, n] of [[nuevo, 'Nuevo'], [viejo, 'Viejo']]) await db.query(`INSERT INTO clientes (id, empresa_id, nombre) VALUES ($1, $2, $3)`, [id, empresa, n]);

    // El vendedor vende 3 mates en la feria a un cliente nuevo; la dueña, 2 en el local a un cliente de hace un año.
    const ventaVendedor = await venta(vendedor, 60_000, 'Feria', 3, nuevo);
    await venta(dueno, 40_000, 'Local', 2, viejo);
    await venta(dueno, 0, 'Local', 0, viejo, '400 days');
    // Le devuelven 1 mate al vendedor.
    const dev = randomUUID();
    await db.query(`INSERT INTO devoluciones (id, empresa_id, tipo, venta_id, usuario_id, estado) VALUES ($1, $2, 'devolucion', $3, $4, 'procesado')`, [dev, empresa, ventaVendedor, vendedor]);
    await db.query(`INSERT INTO devoluciones_items (id, devolucion_id, producto_id, cantidad, precio_unitario, tipo) VALUES ($1, $2, $3, 1, 20000, 'devuelto')`, [randomUUID(), dev, producto]);
    // El vendedor cobra 15.000 de cuenta corriente.
    await db.query(`INSERT INTO cobros_clientes (id, empresa_id, monto, forma_pago, fecha, usuario_id) VALUES ($1, $2, 15000, 'efectivo', now(), $3)`, [randomUUID(), empresa, vendedor]);

    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('mide los tipos nuevos y descuenta las devoluciones del vendedor y la sucursal de la venta', async () => {
    for (const body of [
      { tipo: 'facturacion', periodo: 'mes', meta: 100_000, usuarioId: vendedor },
      { tipo: 'facturacion', periodo: 'mes', meta: 100_000, ubicacion: 'Feria' },
      { tipo: 'ticket_promedio', periodo: 'mes', meta: 50_000 },
      { tipo: 'unidades', periodo: 'mes', meta: 10 },
      { tipo: 'unidades', periodo: 'mes', meta: 10, usuarioId: vendedor, productoId: producto },
      { tipo: 'clientes_nuevos', periodo: 'mes', meta: 5 },
      { tipo: 'clientes_nuevos', periodo: 'mes', meta: 5, usuarioId: dueno },
      { tipo: 'cobranza', periodo: 'mes', meta: 30_000, usuarioId: vendedor },
    ]) {
      await crear(body).expect(201);
    }
    const l = await lista();
    const v = (tipo: string, f: (o: (typeof l)[number]) => boolean = (o) => !o.usuario && !o.ubicacion) => l.find((o) => o.tipo === tipo && f(o))?.actual.valor;
    expect(v('facturacion', (o) => o.usuario?.id === vendedor)).toBe(40_000);
    expect(v('facturacion', (o) => o.ubicacion === 'Feria')).toBe(40_000);
    expect(v('ticket_promedio')).toBe(50_000);
    expect(v('unidades')).toBe(5);
    expect(v('unidades', (o) => o.usuario?.id === vendedor)).toBe(3);
    expect(v('clientes_nuevos')).toBe(1);
    expect(v('clientes_nuevos', (o) => o.usuario?.id === dueno)).toBe(0);
    expect(v('cobranza', (o) => o.usuario?.id === vendedor)).toBe(15_000);
  });

  it('la cobranza no se mide por sucursal', async () => {
    await crear({ tipo: 'cobranza', periodo: 'mes', meta: 1, ubicacion: 'Feria' }).expect(400);
  });

  it('meta propia de un período, y al sacarla vuelve la general', async () => {
    const o = (await lista()).find((x) => x.tipo === 'ticket_promedio')!;
    const put = (desde: string, meta: number | null) => request(app.getHttpServer()).put(`/objetivos/${o.id}/metas`).set(DUENO).send({ desde, meta });
    await put(inicioDeMes, 80_000).expect(204);
    let x = (await lista()).find((y) => y.id === o.id)!;
    expect([x.meta, x.actual.meta, x.metasPeriodo]).toEqual([50_000, 80_000, [{ desde: inicioDeMes, meta: 80_000 }]]);
    await put(inicioDeMes, null).expect(204);
    x = (await lista()).find((y) => y.id === o.id)!;
    expect(x.actual.meta).toBe(50_000);
    await put(finDeMes, 1).expect(400); // no es el comienzo de un período
    await request(app.getHttpServer()).put(`/objetivos/${o.id}/metas`).set(VENDEDOR).send({ desde: inicioDeMes, meta: 1 }).expect(403);
  });

  it('avisa una sola vez a la dueña y al responsable cuando a este ritmo no llega', async () => {
    await crear({ tipo: 'facturacion', periodo: 'mes', meta: 100_000_000 }).expect(201);
    await crear({ tipo: 'cobranza', periodo: 'mes', meta: 100_000_000, usuarioId: vendedor }).expect(201);
    const { ObjetivosService } = await import('../src/modules/objetivos/objetivos.service.js');
    const servicio = app.get(ObjetivosService);
    await servicio.revisarAvisos(finDeMes);
    await servicio.revisarAvisos(finDeMes); // la segunda vuelta no repite
    const { rows } = await db.query(`SELECT u.nombre, count(*)::int AS n FROM objetivo_avisos a JOIN usuarios u ON u.id = a.usuario_id WHERE a.empresa_id = $1 GROUP BY 1 ORDER BY 1`, [empresa]);
    // La dueña recibe todos los que no llegan; el vendedor, solo los suyos.
    const deVendedor = rows.find((r) => r.nombre === 'Vendedor')?.n ?? 0;
    const deDuena = rows.find((r) => r.nombre === 'Dueña')?.n ?? 0;
    expect(deDuena).toBeGreaterThan(deVendedor);
    expect(deVendedor).toBeGreaterThanOrEqual(1);

    const avisos = (await request(app.getHttpServer()).get('/objetivos/avisos').set(VENDEDOR).expect(200)).body as { id: string; mensaje: string }[];
    expect(avisos.length).toBe(deVendedor);
    expect(avisos[0].mensaje).toContain('A este ritmo cerrás en');
    await request(app.getHttpServer()).post(`/objetivos/avisos/${avisos[0].id}/leido`).set(VENDEDOR).expect(204);
    const despues = (await request(app.getHttpServer()).get('/objetivos/avisos').set(VENDEDOR).expect(200)).body as unknown[];
    expect(despues.length).toBe(deVendedor - 1);
  });
});
