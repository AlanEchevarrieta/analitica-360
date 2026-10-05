// Baja de una cuenta completa a pedido (Ley 25.326): se pide, 30 días en solo lectura,
// se puede cancelar, y al ejecutarse se borra todo lo del negocio salvo nuestros cobros
// y la bitácora (con los datos personales tapados y la cadena intacta).
//
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts bajas
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

describe.skipIf(!URL_E2E)('Baja de cuentas (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const otra = randomUUID();
  const usuario = randomUUID();
  const DUENO = { Authorization: `Bearer user_baja_${sufijo}|org_baja_${sufijo}` };
  const OTRA = { Authorization: `Bearer user_bajaotra_${sufijo}|org_bajaotra_${sufijo}` };
  const ADMIN = { Authorization: `Bearer user_bajaadm_${sufijo}|org_bajaadm_${sufijo}` };
  const NOMBRE = `Almacén Ñandú ${sufijo}`;
  const organizacionesBorradas: string[] = [];
  const s = () => app.getHttpServer();
  const cuenta = async (tabla: string, emp = empresa) => Number((await db.query(`SELECT count(*) AS n FROM ${tabla} WHERE empresa_id = $1`, [emp])).rows[0].n);

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const alta = async (id: string, nombre: string, org: string, user: string, email: string, uid = randomUUID()) => {
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id, cuit) VALUES ($1, $2, $3, $4)`, [id, nombre, org, id === empresa ? '20123456789' : null]);
      await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueño', $3, $4, 'dueno')`, [uid, id, email, user]);
      await suscripcionActiva(db, id);
    };
    await alta(empresa, NOMBRE, `org_baja_${sufijo}`, `user_baja_${sufijo}`, `baja_${sufijo}@e2e.test`, usuario);
    await alta(otra, `Otra ${sufijo}`, `org_bajaotra_${sufijo}`, `user_bajaotra_${sufijo}`, `bajaotra_${sufijo}@e2e.test`);
    const adm = randomUUID();
    await alta(adm, 'Admin', `org_bajaadm_${sufijo}`, `user_bajaadm_${sufijo}`, `bajaadm_${sufijo}@e2e.test`);
    await db.query(`INSERT INTO admin_emails (email) VALUES ($1)`, [`bajaadm_${sufijo}@e2e.test`]);

    const { AppModule } = await import('../src/app.module.js');
    const { ClerkCuentasService } = await import('../src/modules/registro/clerk-cuentas.service.js');
    app = (
      await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(ClerkCuentasService)
        .useValue({ borrarOrganizacion: async (org: string) => void organizacionesBorradas.push(org) })
        .compile()
    ).createNestApplication();
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('carga datos del negocio por la API (quedan en la bitácora) y por debajo, en tablas que cuelgan de otras', async () => {
    const p = await request(s()).post('/productos').set(DUENO).send({ nombre: 'Mate secreto', precioVenta: 1000 }).expect(201);
    const c = await request(s()).post('/clientes').set(DUENO).send({ nombre: 'Juan Pérez', telefono: '2615550000' }).expect(201);
    await request(s()).post('/productos').set(OTRA).send({ nombre: 'De la otra', precioVenta: 5 }).expect(201);
    const venta = randomUUID();
    const pedido = randomUUID();
    const ticket = randomUUID();
    const cuentaTienda = randomUUID();
    await db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, forma_pago, cliente_id) VALUES ($1, $2, $3, 'efectivo', $4)`, [venta, empresa, usuario, c.body.id]);
    await db.query(`INSERT INTO ventas_items (id, venta_id, empresa_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4, 1, 1000)`, [randomUUID(), venta, empresa, p.body.id]);
    await db.query(`INSERT INTO pedidos (id, empresa_id, numero_pedido) VALUES ($1, $2, $3)`, [pedido, empresa, `P-${sufijo}`]);
    await db.query(`INSERT INTO pedidos_items (id, pedido_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, 1, 1000)`, [randomUUID(), pedido, p.body.id]);
    await db.query(`INSERT INTO tickets (id, empresa_id, asunto, descripcion) VALUES ($1, $2, 'Ayuda', 'Mi teléfono es 2615550000')`, [ticket, empresa]);
    await db.query(`INSERT INTO tickets_respuestas (id, ticket_id, contenido) VALUES ($1, $2, 'ok')`, [randomUUID(), ticket]);
    await db.query(`INSERT INTO cuentas_tienda (id, empresa_id, cliente_id, email) VALUES ($1, $2, $3, 'compradora@e2e.test')`, [cuentaTienda, empresa, c.body.id]);
    await db.query(`INSERT INTO sesiones_tienda (id, cuenta_id, token_hash, expira) VALUES ($1, $2, $3, now() + interval '1 day')`, [randomUUID(), cuentaTienda, randomUUID().replace(/-/g, '')]);
    await db.query(`INSERT INTO favoritos_tienda (cuenta_id, producto_id) VALUES ($1, $2)`, [cuentaTienda, p.body.id]);
    await db.query(`INSERT INTO pagos (id, empresa_id, monto_ars, metodo, estado) VALUES ($1, $2, 49000, 'transferencia', 'confirmado')`, [randomUUID(), empresa]);
    expect(await cuenta('productos')).toBe(1);
  });

  it('pedir la baja: hay que escribir el nombre del negocio', async () => {
    await request(s()).post('/cuenta/baja').set(DUENO).send({ confirmacion: 'otro nombre' }).expect(400);
    const r = await request(s()).post('/cuenta/baja').set(DUENO).send({ confirmacion: `  almacen ñandu ${sufijo.toUpperCase()} ` }).expect(201);
    expect(r.body).toMatchObject({ diasRestantes: 30, solicitadaPor: `baja_${sufijo}@e2e.test` });
    await request(s()).post('/cuenta/baja').set(DUENO).send({ confirmacion: NOMBRE }).expect(409);
  });

  it('mientras tanto: solo lectura, pero puede descargar sus datos y cancelar', async () => {
    const sub = await request(s()).get('/suscripcion').set(DUENO).expect(200);
    expect(sub.body.acceso).toMatchObject({ nivel: 'solo_lectura', motivo: 'baja_programada', puedeExportar: true });
    const bloqueo = await request(s()).post('/clientes').set(DUENO).send({ nombre: 'Nuevo' }).expect(403);
    expect(bloqueo.body.code).toBe('cuenta_solo_lectura');
    await request(s()).get('/import-export/exportar/productos').set(DUENO).expect(200);
    await request(s()).delete('/cuenta/baja').set(DUENO).expect(200);
    expect((await request(s()).get('/suscripcion').set(DUENO).expect(200)).body.acceso.nivel).toBe('activo');
    await request(s()).post('/cuenta/baja').set(DUENO).send({ confirmacion: NOMBRE }).expect(201);
  });

  it('solo la consola ve las bajas y puede ejecutarlas antes de tiempo', async () => {
    await request(s()).get('/admin/bajas').set(DUENO).expect(403);
    await request(s()).post(`/admin/bajas/${empresa}/ejecutar`).set(DUENO).expect(403);
    const l = await request(s()).get('/admin/bajas').set(ADMIN).expect(200);
    expect(l.body.find((x: { empresaId: string }) => x.empresaId === empresa)).toMatchObject({ nombre: NOMBRE, ejecutadaEn: null });
  });

  it('al ejecutarse: se borra todo lo del negocio y quedan los cobros', async () => {
    const r = await request(s()).post(`/admin/bajas/${empresa}/ejecutar`).set(ADMIN).expect(200);
    expect(r.body.filasBorradas).toBeGreaterThan(5);
    for (const t of ['productos', 'clientes', 'ventas', 'ventas_items', 'pedidos', 'tickets', 'cuentas_tienda', 'usuarios', 'configuracion_empresa']) expect(await cuenta(t), t).toBe(0);
    expect(Number((await db.query(`SELECT count(*) AS n FROM tickets_respuestas WHERE contenido = 'ok' AND ticket_id NOT IN (SELECT id FROM tickets)`)).rows[0].n)).toBe(0);
    expect(await cuenta('pagos')).toBe(1);
    expect(await cuenta('suscripciones')).toBe(1);
    const e = (await db.query(`SELECT nombre, cuit, clerk_org_id, activo, deleted_at IS NOT NULL AS borrada FROM empresas WHERE id = $1`, [empresa])).rows[0];
    expect(e).toEqual({ nombre: 'Cuenta borrada', cuit: null, clerk_org_id: null, activo: false, borrada: true });
    expect(organizacionesBorradas).toEqual([`org_baja_${sufijo}`]);
    // La otra empresa, intacta.
    expect(await cuenta('productos', otra)).toBe(1);
  });

  it('la bitácora queda con los datos personales tapados, la constancia de la baja y la cadena íntegra', async () => {
    const filas = (await db.query(`SELECT actor_nombre, entidad_nombre, resumen, cambios, ip FROM registro_auditoria WHERE empresa_id = $1 ORDER BY id`, [empresa])).rows;
    const tapadas = filas.slice(0, -1);
    expect(tapadas.length).toBeGreaterThan(0);
    for (const f of tapadas) expect(f).toMatchObject({ actor_nombre: '[borrado]', resumen: '[datos borrados a pedido del titular]', cambios: null, ip: null });
    expect(JSON.stringify(filas)).not.toMatch(/Juan Pérez|Mate secreto|baja_.*@e2e\.test/);
    expect(filas.at(-1).resumen).toContain('Se borraron los datos de la cuenta');
    const v = (await db.query(`SELECT count(*) FILTER (WHERE hash <> registro_auditoria_esperado(r, prev)) AS errores FROM (SELECT r, r.hash, lag(r.hash) OVER (ORDER BY r.id) AS prev FROM registro_auditoria r) x`)).rows[0];
    expect(Number(v.errores)).toBe(0);
    // Y sigue sin poder tocarse.
    await expect(db.query(`UPDATE registro_auditoria SET resumen = 'x' WHERE empresa_id = $1`, [empresa])).rejects.toThrow(/no se puede modificar/);
  });

  it('no se puede borrar dos veces', async () => {
    await request(s()).post(`/admin/bajas/${empresa}/ejecutar`).set(ADMIN).expect(409);
  });
});
