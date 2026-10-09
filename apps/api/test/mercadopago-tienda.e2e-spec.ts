// Mercado Pago en las tiendas de punta a punta, con Mercado Pago simulado: el dueño conecta su cuenta
// (OAuth con PKCE y state cifrado), la tienda ofrece Mercado Pago, el pedido devuelve el link de pago,
// el aviso de pago se verifica preguntándole a Mercado Pago (pago de otro pedido o por menos no cuenta),
// un rechazo posterior no pisa el pago aprobado, el token se renueva solo y el dueño desconecta.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts mercadopago-tienda
import { createHash, randomBytes, randomUUID } from 'node:crypto';
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

/** Mercado Pago de mentira: guarda el desafío PKCE, las preferencias y los pagos. */
class MpFalso {
  configurado = true;
  desafio = '';
  renovaciones = 0;
  preferencias: { token: string; datos: Record<string, unknown> }[] = [];
  pagos = new Map<string, { id: number; status: string; external_reference: string; transaction_amount: number; date_approved?: string }>();
  async intercambiar(code: string, verificador: string) {
    if (code !== 'codigo-bueno' || createHash('sha256').update(verificador).digest('base64url') !== this.desafio) throw new Error('PKCE inválido');
    return { accessToken: 'APP_USR-comercio-1', refreshToken: 'TG-refresh-1', publicKey: 'APP_USR-pk', userId: '424242', expiresIn: 15_552_000 };
  }
  async renovar(refresh: string) {
    this.renovaciones++;
    return { accessToken: `APP_USR-comercio-renovado-${refresh}`, refreshToken: 'TG-refresh-2', publicKey: 'APP_USR-pk', userId: '424242', expiresIn: 15_552_000 };
  }
  async crearPreferencia(token: string, datos: Record<string, unknown>) {
    this.preferencias.push({ token, datos });
    return { id: `pref-${this.preferencias.length}`, initPoint: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-${this.preferencias.length}` };
  }
  async pago(_token: string, id: string) {
    const p = this.pagos.get(id);
    if (!p) throw new Error('no existe');
    return p;
  }
}

describe.skipIf(!URL_E2E)('Mercado Pago en las tiendas (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const mp = new MpFalso();
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const mate = randomUUID();
  const DUENO = { Authorization: `Bearer user_mpd_${sufijo}|org_mp_${sufijo}` };
  const EMPLEADO = { Authorization: `Bearer user_mpe_${sufijo}|org_mp_${sufijo}` };
  const cliente = { clienteNombre: 'Ana', clienteEmail: 'ana@example.com', clienteTelefono: '2615555555', direccionEnvio: 'San Martín 100', codigoPostal: '5500', localidad: 'Mendoza', provincia: 'Mendoza' };
  const s = () => app.getHttpServer();
  let ip = 1;
  const publico = () => ({ 'x-forwarded-for': `10.2.0.${ip++}` });
  let pedido = '';
  let clave = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    process.env.CLAVE_CIFRADO = randomBytes(32).toString('base64');
    process.env.API_URL_PUBLICA = 'https://api.ejemplo.test';
    process.env.APP_URL_PUBLICA = 'https://app.ejemplo.test';
    process.env.MP_CLIENT_ID = '1234567890';
    process.env.MP_CLIENT_SECRET = 'secreto-de-la-app';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `MP ${sufijo}`, `org_mp_${sufijo}`]);
    await suscripcionActiva(db, empresa);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueña', $3, $4, 'dueno')`, [randomUUID(), empresa, `mpd_${sufijo}@e2e.test`, `user_mpd_${sufijo}`]);
    const empleado = randomUUID();
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Empleado', $3, $4, 'operador')`, [empleado, empresa, `mpe_${sufijo}@e2e.test`, `user_mpe_${sufijo}`]);
    await db.query(`INSERT INTO colaborador_permisos (id, empresa_id, usuario_id, modulos, acciones) VALUES ($1, $2, $3, '{"pedidos": true}', '{}')`, [randomUUID(), empresa, empleado]);
    await db.query(`INSERT INTO tiendas_config (id, empresa_id, subdominio, nombre, activa) VALUES ($1, $2, $3, 'Mates del Sur', true)`, [randomUUID(), empresa, `mp-${sufijo}`]);
    await db.query(`INSERT INTO productos (id, empresa_id, nombre, precio_venta, en_tienda) VALUES ($1, $2, 'Mate Imperial', 20000, true)`, [mate, empresa]);
    const { AppModule } = await import('../src/app.module.js');
    const { MpTiendaCliente } = await import('../src/modules/mercadopago-tienda/mp-tienda.cliente.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(MpTiendaCliente).useValue(mp).compile()).createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const pedirConMp = () => request(s()).post(`/tienda/${empresa}/pedidos`).set(publico()).send({ ...cliente, items: [{ productoId: mate, cantidad: 2 }], formaPago: 'mercadopago' });
  const avisar = (id: string, k = clave) => request(s()).post(`/webhooks/mercadopago-tienda/${k}`).send({ type: 'payment', data: { id } });
  const estadoPedido = async (id: string) => (await db.query(`SELECT pago_estado, pago_id, pagado_en FROM pedidos WHERE id = $1`, [id])).rows[0];

  it('sin conectar, la tienda no ofrece Mercado Pago y un pedido con Mercado Pago se rechaza', async () => {
    const c = await request(s()).get(`/tienda/${empresa}/condiciones`).set(publico()).expect(200);
    expect(c.body.mercadoPago).toBe(false);
    await pedirConMp().expect(400);
  });

  it('solo el dueño conecta: OAuth con PKCE y state cifrado; un state adulterado o un error vuelven a la app sin conectar', async () => {
    await request(s()).post('/mercadopago/tienda/conectar').set(EMPLEADO).expect(403);
    const r = await request(s()).post('/mercadopago/tienda/conectar').set(DUENO).expect(200);
    const url = new URL(r.body.url);
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.ejemplo.test/mercadopago/tienda/vuelta');
    expect(url.searchParams.get('state')).not.toContain(empresa);
    mp.desafio = url.searchParams.get('code_challenge')!;
    const state = url.searchParams.get('state')!;

    const mal = await request(s()).get('/mercadopago/tienda/vuelta').query({ code: 'codigo-bueno', state: state.slice(0, -4) + 'AAAA' }).expect(302);
    expect(mal.headers.location).toBe('https://app.ejemplo.test/configuracion?s=mercadopago&mp=error');
    const cancelado = await request(s()).get('/mercadopago/tienda/vuelta').query({ error: 'access_denied', state }).expect(302);
    expect(cancelado.headers.location).toContain('mp=cancelado');

    const ok = await request(s()).get('/mercadopago/tienda/vuelta').query({ code: 'codigo-bueno', state }).expect(302);
    expect(ok.headers.location).toBe('https://app.ejemplo.test/configuracion?s=mercadopago&mp=ok');
    const e = await request(s()).get('/mercadopago/tienda').set(DUENO).expect(200);
    expect(e.body).toMatchObject({ disponible: true, cuenta: { mpUserId: '424242' } });
    const { rows } = await db.query(`SELECT credenciales, aviso_clave FROM mp_cuentas_tienda WHERE empresa_id = $1`, [empresa]);
    expect(rows[0].credenciales).not.toContain('APP_USR');
    clave = rows[0].aviso_clave;
  });

  it('la tienda ofrece Mercado Pago y el pedido devuelve el link de pago por el total, sin descuento por transferencia', async () => {
    const c = await request(s()).get(`/tienda/${empresa}/condiciones`).set(publico()).expect(200);
    expect(c.body.mercadoPago).toBe(true);
    const r = await pedirConMp().expect(201);
    expect(r.body).toMatchObject({ total: 40_000, descuentoTransferencia: 0, pagoUrl: expect.stringContaining('pref_id=') });
    pedido = r.body.id;
    const pref = mp.preferencias.at(-1)!;
    expect(pref.token).toBe('APP_USR-comercio-1');
    expect(pref.datos).toMatchObject({
      total: 40_000,
      referencia: pedido,
      email: 'ana@example.com',
      avisos: `https://api.ejemplo.test/webhooks/mercadopago-tienda/${clave}`,
      volverA: expect.stringMatching(new RegExp(`^https://mp-${sufijo}\\.analitica360\\.app/pedido-confirmado\\?n=.+&id=${pedido}$`)),
    });
    expect(await estadoPedido(pedido)).toMatchObject({ pago_estado: 'pendiente', pago_id: null });
  });

  it('el aviso se verifica con Mercado Pago: un pago de otro pedido o por menos no lo marca como pagado', async () => {
    await avisar('1', 'clave-que-no-existe-000000000').expect(404);
    mp.pagos.set('500', { id: 500, status: 'approved', external_reference: randomUUID(), transaction_amount: 40_000 });
    await avisar('500').expect(200);
    mp.pagos.set('501', { id: 501, status: 'approved', external_reference: pedido, transaction_amount: 100 });
    await avisar('501').expect(200);
    expect(await estadoPedido(pedido)).toMatchObject({ pago_estado: 'pendiente' });
  });

  it('pago rechazado y después aprobado: el pedido queda pagado y un rechazo posterior de otro intento no lo pisa', async () => {
    mp.pagos.set('600', { id: 600, status: 'rejected', external_reference: pedido, transaction_amount: 40_000 });
    await avisar('600').expect(200);
    expect(await estadoPedido(pedido)).toMatchObject({ pago_estado: 'rejected' });

    // Reintenta desde la confirmación: nuevo link.
    const otra = await request(s()).post(`/tienda/${empresa}/pedidos/${pedido}/pago`).set(publico()).expect(201);
    expect(otra.body).toMatchObject({ estado: 'rejected', url: expect.stringContaining('pref_id=') });

    mp.pagos.set('601', { id: 601, status: 'approved', external_reference: pedido, transaction_amount: 40_000, date_approved: '2026-10-08T15:00:00.000-03:00' });
    await avisar('601').expect(200);
    await avisar('601').expect(200); // Mercado Pago repite avisos: no pasa nada.
    expect(await estadoPedido(pedido)).toMatchObject({ pago_estado: 'approved', pago_id: '601' });

    mp.pagos.set('602', { id: 602, status: 'rejected', external_reference: pedido, transaction_amount: 40_000 });
    await avisar('602').expect(200);
    expect(await estadoPedido(pedido)).toMatchObject({ pago_estado: 'approved', pago_id: '601' });

    const pagado = await request(s()).post(`/tienda/${empresa}/pedidos/${pedido}/pago`).set(publico()).expect(201);
    expect(pagado.body).toEqual({ estado: 'approved', url: null });
    const f = await request(s()).get(`/pedidos/${pedido}`).set(DUENO).expect(200);
    expect(f.body.pago).toMatchObject({ estado: 'approved', id: '601' });
  });

  it('una devolución del pago aprobado sí se refleja', async () => {
    mp.pagos.set('601', { id: 601, status: 'refunded', external_reference: pedido, transaction_amount: 40_000 });
    await avisar('601').expect(200);
    expect(await estadoPedido(pedido)).toMatchObject({ pago_estado: 'refunded', pagado_en: null });
  });

  it('si el token está por vencer, se renueva una sola vez aunque lleguen dos pedidos juntos', async () => {
    await db.query(`UPDATE mp_cuentas_tienda SET vence_en = now() + interval '2 days' WHERE empresa_id = $1`, [empresa]);
    const [a, b] = await Promise.all([pedirConMp(), pedirConMp()]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(mp.renovaciones).toBe(1);
    expect(mp.preferencias.at(-1)!.token).toBe('APP_USR-comercio-renovado-TG-refresh-1');
  });

  it('el dueño desconecta y la tienda deja de ofrecer Mercado Pago', async () => {
    await request(s()).delete('/mercadopago/tienda').set(EMPLEADO).expect(403);
    await request(s()).delete('/mercadopago/tienda').set(DUENO).expect(204);
    const c = await request(s()).get(`/tienda/${empresa}/condiciones`).set(publico()).expect(200);
    expect(c.body.mercadoPago).toBe(false);
  });
});
