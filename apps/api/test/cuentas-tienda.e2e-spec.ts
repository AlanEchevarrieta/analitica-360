// Cuentas de compradores de la tienda online de punta a punta (AppModule
// completo): código por email (vencimiento, un solo uso, bloqueo por intentos),
// sesiones que no sirven en otra tienda, vínculo con el cliente, mis pedidos,
// favoritos, salir y borrar la cuenta.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts cuentas
import { randomUUID } from 'node:crypto';
import { type INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const URL_E2E = process.env.E2E_DATABASE_URL;

vi.mock('@clerk/backend', async (original) => ({
  ...(await original<typeof import('@clerk/backend')>()),
  verifyToken: async () => {
    throw new Error('sin Clerk en este test');
  },
}));

describe.skipIf(!URL_E2E)('Cuentas de la tienda online (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const otraEmpresa = randomUUID();
  const producto = randomUUID();
  const productoAjeno = randomUUID();
  const ana = `ana.perez_${sufijo}@example.com`;
  const s = () => app.getHttpServer();
  let ip = 1;
  const publico = (extra: Record<string, string> = {}) => ({ 'x-forwarded-for': `10.1.0.${ip++}`, ...extra });
  // El código llega por email; en desarrollo (sin Resend) la API lo escribe en el log: el test lo lee de ahí.
  const codigos = new Map<string, string>();
  const ultimoCodigo = (email: string) => codigos.get(email.toLowerCase());

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e-secreto-largo';
    delete process.env.RESEND_API_KEY;
    delete process.env.GOOGLE_CLIENT_ID_TIENDAS;
    vi.spyOn(Logger.prototype, 'warn').mockImplementation((m: unknown) => {
      const r = /Código de ingreso para (\S+): (\d{6})/.exec(String(m));
      if (r) codigos.set(r[1], r[2]);
    });
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    for (const [id, sub] of [[empresa, 'a'], [otraEmpresa, 'b']]) {
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [id, `Cuentas ${sub} ${sufijo}`, `org_cuentas_${sub}_${sufijo}`]);
      await db.query(`INSERT INTO tiendas_config (id, empresa_id, subdominio, nombre, activa) VALUES ($1, $2, $3, 'Tienda', true)`, [randomUUID(), id, `cuentas-${sub}-${sufijo}`]);
    }
    await db.query(`INSERT INTO productos (id, empresa_id, nombre, precio_venta, en_tienda) VALUES ($1, $3, 'Mate', 10000, true), ($2, $4, 'Ajeno', 10000, true)`, [producto, productoAjeno, empresa, otraEmpresa]);
    // Ana ya era clienta (la cargaron a mano) y además había comprado como invitada.
    await db.query(`INSERT INTO clientes (id, empresa_id, nombre, email, telefono) VALUES ($1, $2, 'Ana Pérez', $3, '2615550000')`, [randomUUID(), empresa, ana.toUpperCase()]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const cliente = { clienteNombre: 'Ana', clienteTelefono: '2615555555', direccionEnvio: 'San Martín 100', codigoPostal: '5500', localidad: 'Mendoza', provincia: 'Mendoza' };
  const pedidoComo = (email: string, sesion?: string) =>
    request(s())
      .post(`/tienda/${empresa}/pedidos`)
      .set(publico(sesion ? { 'x-sesion-tienda': sesion } : {}))
      .send({ ...cliente, clienteEmail: email, items: [{ productoId: producto, cantidad: 1 }] })
      .expect(201);

  let token: string;

  it('pedir código responde igual exista o no la cuenta, y hay que esperar entre códigos', async () => {
    await pedidoComo(ana); // compra como invitada antes de tener cuenta
    const a = await request(s()).post(`/tienda/${empresa}/cuenta/codigo`).set(publico()).send({ email: ana }).expect(200);
    const b = await request(s()).post(`/tienda/${empresa}/cuenta/codigo`).set(publico()).send({ email: `nadie_${sufijo}@example.com` }).expect(200);
    expect(a.body).toEqual(b.body);
    await request(s()).post(`/tienda/${empresa}/cuenta/codigo`).set(publico()).send({ email: ana }).expect(400);
    const fila = (await db.query(`SELECT codigo_hash FROM codigos_ingreso_tienda WHERE email = $1`, [ana])).rows[0];
    expect(fila.codigo_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(fila.codigo_hash).not.toContain(ultimoCodigo(ana));
  });

  it('código incorrecto: 401; el correcto abre sesión y se vincula a la clienta que ya existía', async () => {
    await request(s()).post(`/tienda/${empresa}/cuenta/ingresar`).set(publico()).send({ email: ana, codigo: '000000' === ultimoCodigo(ana) ? '111111' : '000000' }).expect(401);
    const r = await request(s()).post(`/tienda/${empresa}/cuenta/ingresar`).set(publico()).send({ email: ana.toUpperCase(), codigo: ultimoCodigo(ana) }).expect(200);
    token = r.body.token;
    expect(r.body.cuenta).toMatchObject({ email: ana, nombre: 'Ana Pérez', telefono: '2615550000' });
    const clientes = (await db.query(`SELECT count(*)::int AS n FROM clientes WHERE empresa_id = $1 AND lower(email) = $2`, [empresa, ana])).rows[0].n;
    expect(clientes).toBe(1); // no se duplicó
    const sesion = (await db.query(`SELECT token_hash FROM sesiones_tienda s JOIN cuentas_tienda c ON c.id = s.cuenta_id WHERE c.email = $1`, [ana])).rows[0];
    expect(sesion.token_hash).not.toBe(token);
  });

  it('el mismo código no sirve dos veces', async () => {
    await request(s()).post(`/tienda/${empresa}/cuenta/ingresar`).set(publico()).send({ email: ana, codigo: ultimoCodigo(ana) }).expect(401);
  });

  it('5 intentos fallidos bloquean el código aunque después se ponga bien', async () => {
    const beto = `beto_${sufijo}@example.com`;
    await request(s()).post(`/tienda/${empresa}/cuenta/codigo`).set(publico()).send({ email: beto }).expect(200);
    const bueno = ultimoCodigo(beto)!;
    const malo = bueno === '123456' ? '654321' : '123456';
    for (let i = 0; i < 5; i++) await request(s()).post(`/tienda/${empresa}/cuenta/ingresar`).set(publico()).send({ email: beto, codigo: malo }).expect(401);
    await request(s()).post(`/tienda/${empresa}/cuenta/ingresar`).set(publico()).send({ email: beto, codigo: bueno }).expect(401);
  });

  it('un código vencido no sirve', async () => {
    const caro = `caro_${sufijo}@example.com`;
    await request(s()).post(`/tienda/${empresa}/cuenta/codigo`).set(publico()).send({ email: caro }).expect(200);
    await db.query(`UPDATE codigos_ingreso_tienda SET expira = now() - interval '1 minute' WHERE email = $1`, [caro]);
    await request(s()).post(`/tienda/${empresa}/cuenta/ingresar`).set(publico()).send({ email: caro, codigo: ultimoCodigo(caro) }).expect(401);
  });

  it('la sesión de una tienda no sirve en otra, y sin sesión no hay datos', async () => {
    await request(s()).get(`/tienda/${empresa}/cuenta`).set(publico({ 'x-sesion-tienda': token })).expect(200);
    await request(s()).get(`/tienda/${otraEmpresa}/cuenta`).set(publico({ 'x-sesion-tienda': token })).expect(401);
    await request(s()).get(`/tienda/${empresa}/cuenta`).set(publico()).expect(401);
    await request(s()).get(`/tienda/${empresa}/cuenta/pedidos`).set(publico({ 'x-sesion-tienda': 'x'.repeat(43) })).expect(401);
  });

  it('mis datos: se guardan y actualizan a la clienta del negocio', async () => {
    const r = await request(s()).patch(`/tienda/${empresa}/cuenta`).set(publico({ 'x-sesion-tienda': token })).send({ nombre: 'Ana María Pérez', telefono: '2614440000', calle: 'Belgrano', numero: '50', ciudad: 'Godoy Cruz', provincia: 'Mendoza', codigoPostal: '5501' }).expect(200);
    expect(r.body).toMatchObject({ nombre: 'Ana María Pérez', ciudad: 'Godoy Cruz' });
    const c = (await db.query(`SELECT nombre, telefono FROM clientes WHERE empresa_id = $1 AND lower(email) = $2`, [empresa, ana])).rows[0];
    expect(c).toEqual({ nombre: 'Ana María Pérez', telefono: '2614440000' });
  });

  it('mis pedidos: el de la cuenta y el que hizo antes como invitada; nunca los de otro email', async () => {
    await pedidoComo(ana, token);
    await pedidoComo(`otra_${sufijo}@example.com`);
    const r = await request(s()).get(`/tienda/${empresa}/cuenta/pedidos`).set(publico({ 'x-sesion-tienda': token })).expect(200);
    expect(r.body).toHaveLength(2);
    expect(r.body[0]).toMatchObject({ estado: 'nuevo', total: 10000, items: [{ nombre: 'Mate', cantidad: 1, precio: 10000 }] });
    const conCliente = (await db.query(`SELECT count(*)::int AS n FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.empresa_id = $1 AND lower(c.email) = $2`, [empresa, ana])).rows[0].n;
    expect(conCliente).toBe(1); // el hecho con sesión queda atado a la clienta
  });

  it('favoritos: marcar, desmarcar y no se puede marcar un producto de otra tienda', async () => {
    const h = publico({ 'x-sesion-tienda': token });
    expect((await request(s()).put(`/tienda/${empresa}/cuenta/favoritos/${producto}`).set(h).expect(200)).body).toEqual([producto]);
    await request(s()).put(`/tienda/${empresa}/cuenta/favoritos/${productoAjeno}`).set(publico({ 'x-sesion-tienda': token })).expect(404);
    expect((await request(s()).delete(`/tienda/${empresa}/cuenta/favoritos/${producto}`).set(publico({ 'x-sesion-tienda': token })).expect(200)).body).toEqual([]);
  });

  it('Google sin configurar: lo dice claro', async () => {
    await request(s()).post(`/tienda/${empresa}/cuenta/google`).set(publico()).send({ credential: 'x'.repeat(40) }).expect(503);
  });

  it('salir invalida la sesión', async () => {
    await request(s()).post(`/tienda/${empresa}/cuenta/salir`).set(publico({ 'x-sesion-tienda': token })).expect(204);
    await request(s()).get(`/tienda/${empresa}/cuenta`).set(publico({ 'x-sesion-tienda': token })).expect(401);
  });

  it('borrar la cuenta: se van la cuenta, sesiones y favoritos; la clienta y sus pedidos quedan', async () => {
    await request(s()).post(`/tienda/${empresa}/cuenta/codigo`).set(publico()).send({ email: `dani_${sufijo}@example.com` }).expect(200);
    const t = (await request(s()).post(`/tienda/${empresa}/cuenta/ingresar`).set(publico()).send({ email: `dani_${sufijo}@example.com`, codigo: ultimoCodigo(`dani_${sufijo}@example.com`) }).expect(200)).body.token;
    await request(s()).put(`/tienda/${empresa}/cuenta/favoritos/${producto}`).set(publico({ 'x-sesion-tienda': t })).expect(200);
    await pedidoComo(`dani_${sufijo}@example.com`, t);
    await request(s()).delete(`/tienda/${empresa}/cuenta`).set(publico({ 'x-sesion-tienda': t })).expect(200);
    await request(s()).get(`/tienda/${empresa}/cuenta`).set(publico({ 'x-sesion-tienda': t })).expect(401);
    const quedan = (await db.query(`SELECT (SELECT count(*) FROM cuentas_tienda WHERE email = $1)::int AS cuentas, (SELECT count(*) FROM clientes WHERE email = $1)::int AS clientes, (SELECT count(*) FROM pedidos WHERE cliente_email = $1)::int AS pedidos`, [`dani_${sufijo}@example.com`])).rows[0];
    expect(quedan).toEqual({ cuentas: 0, clientes: 1, pedidos: 1 });
  });
});
