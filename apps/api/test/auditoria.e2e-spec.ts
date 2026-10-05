// Bitácora de auditoría de punta a punta (AppModule completo, guards reales):
// registra quién cambió qué con antes/después, no se puede alterar, detecta
// manipulaciones y cada empresa ve solo lo suyo.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts auditoria
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

const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

describe.skipIf(!URL_E2E)('Bitácora de auditoría (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const bearer = (q: string) => ({ Authorization: `Bearer user_aud_${q}_${sufijo}|org_aud_${q === 'b' ? 'b' : 'a'}_${sufijo}` });
  const DUENO = bearer('a');
  const EMPLEADO = bearer('op');
  const OTRA = bearer('b');
  const ADMIN = { Authorization: `Bearer user_aud_admin_${sufijo}|org_aud_admin_${sufijo}` };
  const empresaA = randomUUID();
  const productoId = randomUUID();
  const ventaId = randomUUID();
  const rango = `desde=${hoy}&hasta=${hoy}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const empresas = { a: empresaA, b: randomUUID(), admin: randomUUID() };
    for (const [k, id] of Object.entries(empresas)) {
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [id, `Aud ${k} ${sufijo}`, `org_aud_${k}_${sufijo}`]);
      await suscripcionActiva(db, id);
    }
    const usuarios: [string, string, string, string][] = [
      ['a', empresas.a, 'dueno', 'Dueña A'],
      ['op', empresas.a, 'operador', 'Empleado A'],
      ['b', empresas.b, 'dueno', 'Dueño B'],
      ['admin', empresas.admin, 'dueno', 'Admin'],
    ];
    for (const [k, empresa, rol, nombre] of usuarios) {
      await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [randomUUID(), empresa, nombre, `aud_${k}_${sufijo}@e2e.test`, `user_aud_${k}_${sufijo}`, rol]);
    }
    await db.query(`INSERT INTO admin_emails (email) VALUES ($1)`, [`aud_admin_${sufijo}@e2e.test`]);
    const categoria = randomUUID();
    await db.query(`INSERT INTO categorias (id, empresa_id, nombre) VALUES ($1, $2, 'Mochilas')`, [categoria, empresaA]);
    await db.query(`INSERT INTO productos (id, empresa_id, nombre, precio_venta, costo, categoria_id) VALUES ($1, $2, 'Mochila', 12200, 6000, $3)`, [productoId, empresaA, categoria]);
    const dueno = (await db.query(`SELECT id FROM usuarios WHERE clerk_user_id = $1`, [`user_aud_a_${sufijo}`])).rows[0].id;
    await db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, forma_pago, numero_venta) VALUES ($1, $2, $3, 'efectivo', $4)`, [ventaId, empresaA, dueno, `V-AUD-${sufijo}`]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const bitacora = async (headers: Record<string, string>, extra = '') =>
    (await request(app.getHttpServer()).get(`/auditoria?${rango}${extra}`).set(headers).expect(200)).body;

  it('un cambio de precio queda con quién, antes y después', async () => {
    await request(app.getHttpServer()).patch(`/productos/${productoId}`).set(DUENO).send({ nombre: 'Mochila', precioVenta: 13000, costo: 6000 }).expect(200);
    const b = await bitacora(DUENO, '&entidad=Producto&busqueda=precio');
    expect(b.total).toBe(1);
    expect(b.items[0]).toMatchObject({ actor: 'Dueña A', accion: 'editar', entidadId: productoId, nombre: 'Mochila', resumen: 'editó producto «Mochila»: precio de venta $12.200 → $13.000' });
    expect(b.items[0].cambios).toEqual({ precioVenta: [12200, 13000] });
  });

  it('guardar sin cambios no ensucia la bitácora', async () => {
    const antes = (await bitacora(DUENO, '&entidad=Producto')).total;
    await request(app.getHttpServer()).patch(`/productos/${productoId}`).set(DUENO).send({ nombre: 'Mochila', precioVenta: 13000, costo: 6000 }).expect(200);
    expect((await bitacora(DUENO, '&entidad=Producto')).total).toBe(antes);
  });

  it('editar sin mandar categoría, precio ni costo no los borra (bug que encontró la bitácora)', async () => {
    await request(app.getHttpServer()).patch(`/productos/${productoId}`).set(DUENO).send({ nombre: 'Mochila' }).expect(200);
    const p = (await db.query(`SELECT precio_venta::float AS precio, costo::float AS costo, categoria_id IS NOT NULL AS con_categoria FROM productos WHERE id = $1`, [productoId])).rows[0];
    expect(p).toEqual({ precio: 13000, costo: 6000, con_categoria: true });
  });

  it('editar sin mandar "activo" no reactiva un producto inactivo (segundo bug que encontró la bitácora)', async () => {
    await request(app.getHttpServer()).patch(`/productos/${productoId}`).set(DUENO).send({ nombre: 'Mochila', activo: false }).expect(200);
    await request(app.getHttpServer()).patch(`/productos/${productoId}`).set(DUENO).send({ nombre: 'Mochila' }).expect(200);
    expect((await db.query(`SELECT activo FROM productos WHERE id = $1`, [productoId])).rows[0].activo).toBe(false);
    await request(app.getHttpServer()).patch(`/productos/${productoId}`).set(DUENO).send({ nombre: 'Mochila', activo: true }).expect(200);
  });

  it('anular una venta queda como "anuló venta V-…"', async () => {
    await request(app.getHttpServer()).post(`/ventas/${ventaId}/anular`).set(DUENO).send({ motivo: 'Error de carga' }).expect((r) => expect(r.status).toBeLessThan(300));
    expect((await bitacora(DUENO, '&entidad=Venta&accion=borrar')).total).toBe(0);
    const b = await bitacora(DUENO, '&accion=anular');
    expect(b.items[0]).toMatchObject({ accion: 'anular', entidadId: ventaId, resumen: `anuló venta «V-AUD-${sufijo}»` });
  });

  it('un pedido que falla no deja nada registrado', async () => {
    const antes = (await bitacora(DUENO)).total;
    await request(app.getHttpServer()).patch(`/productos/${randomUUID()}`).set(DUENO).send({ nombre: 'X' }).expect(404);
    expect((await bitacora(DUENO)).total).toBe(antes);
  });

  it('solo el dueño ve la bitácora; un empleado no', async () => {
    await request(app.getHttpServer()).get(`/auditoria?${rango}`).set(EMPLEADO).expect(403);
  });

  it('otra empresa no ve nada de A, y un cliente no entra a la de la consola', async () => {
    expect((await bitacora(OTRA)).total).toBe(0);
    await request(app.getHttpServer()).get(`/admin/auditoria?${rango}`).set(OTRA).expect(403);
    await request(app.getHttpServer()).get('/admin/auditoria/verificar').set(OTRA).expect(403);
  });

  it('el administrador ve todas las empresas', async () => {
    const r = await request(app.getHttpServer()).get(`/admin/auditoria?${rango}&empresaId=${empresaA}`).set(ADMIN).expect(200);
    expect(r.body.items.length).toBeGreaterThanOrEqual(2);
    expect(r.body.items[0].empresa).toBe(`Aud a ${sufijo}`);
  });

  it('nadie puede editar ni borrar la bitácora (ni con acceso directo a la base)', async () => {
    await expect(db.query(`UPDATE registro_auditoria SET resumen = 'nada' WHERE empresa_id = $1`, [empresaA])).rejects.toThrow(/no se puede modificar/);
    await expect(db.query(`DELETE FROM registro_auditoria WHERE empresa_id = $1`, [empresaA])).rejects.toThrow(/no se puede modificar/);
  });

  it('20 cambios al mismo tiempo no rompen la cadena', async () => {
    const t0 = Date.now();
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => request(app.getHttpServer()).patch(`/productos/${productoId}`).set(DUENO).send({ nombre: 'Mochila', precioVenta: 14000 + i })),
    ).then((rs) => expect(rs.map((r) => r.status)).toEqual(Array(20).fill(200)));
    expect(Date.now() - t0).toBeLessThan(15_000);
    const v = await request(app.getHttpServer()).get('/admin/auditoria/verificar').set(ADMIN).expect(200);
    expect(v.body).toMatchObject({ integra: true, errores: 0 });
  }, 60_000);

  it('la cadena de hashes está íntegra y detecta una manipulación', async () => {
    const ok = await request(app.getHttpServer()).get('/admin/auditoria/verificar').set(ADMIN).expect(200);
    expect(ok.body).toMatchObject({ integra: true, errores: 0 });
    expect(ok.body.ultimoHash).toMatch(/^[0-9a-f]{64}$/);

    // Alguien con superusuario apaga el trigger y "corrige" un precio a mano…
    const fila = (await db.query(`SELECT id, resumen FROM registro_auditoria WHERE empresa_id = $1 AND entidad = 'Producto' ORDER BY id LIMIT 1`, [empresaA])).rows[0];
    await db.query(`ALTER TABLE registro_auditoria DISABLE TRIGGER registro_auditoria_sin_cambios`);
    try {
      await db.query(`UPDATE registro_auditoria SET resumen = 'editó producto «Mochila»: precio de venta $12.200 → $12.500' WHERE id = $1`, [fila.id]);
      const mal = await request(app.getHttpServer()).get('/admin/auditoria/verificar').set(ADMIN).expect(200);
      expect(mal.body).toMatchObject({ integra: false, primerError: String(fila.id) });
    } finally {
      // …se deja como estaba para que la base de prueba siga íntegra.
      await db.query(`UPDATE registro_auditoria SET resumen = $2 WHERE id = $1`, [fila.id, fila.resumen]);
      await db.query(`ALTER TABLE registro_auditoria ENABLE TRIGGER registro_auditoria_sin_cambios`);
    }
    const otraVez = await request(app.getHttpServer()).get('/admin/auditoria/verificar').set(ADMIN).expect(200);
    expect(otraVez.body.integra).toBe(true);
  });
});
