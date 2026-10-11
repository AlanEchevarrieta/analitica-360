// Documentos de punta a punta (AppModule completo, guards reales): comprobante
// de venta y recibo en PDF, numeración de recibos, link público para WhatsApp,
// email (Resend simulado), configuración y aislamiento entre empresas.
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts documentos
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

describe.skipIf(!URL_E2E)('Documentos: comprobante y recibo (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const otra = randomUUID();
  const dueno = randomUUID();
  const cliente = randomUUID();
  const venta = randomUUID();
  const ventaOtra = randomUUID();
  const cobros = [randomUUID(), randomUUID(), randomUUID()];
  const DUENO = { Authorization: `Bearer user_dcd_${sufijo}|org_dc_${sufijo}` };
  const VENDEDOR = { Authorization: `Bearer user_dcv_${sufijo}|org_dc_${sufijo}` };
  const AJENO = { Authorization: `Bearer user_dco_${sufijo}|org_dco_${sufijo}` };
  const emails: { to: string[]; subject: string; reply_to?: string; attachments: { filename: string; content: string }[] }[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    process.env.RESEND_API_KEY = 're_e2e';
    const original = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).startsWith('https://api.resend.com/')) {
        emails.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ id: 'e2e' }), { status: 200 });
      }
      return original(url, init);
    });
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const usuario = (id: string, emp: string, user: string, rol: string, permisos = '{}') =>
      db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol, permisos) VALUES ($1, $2, 'U', $3, $4, $5, $6)`, [id, emp, `${user}@e2e.test`, user, rol, permisos]);
    // Plan Básico: el comprobante y el recibo están en todos los planes.
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id, cuit) VALUES ($1, $2, $3, '20123456786')`, [empresa, `Docs ${sufijo}`, `org_dc_${sufijo}`]);
    await usuario(dueno, empresa, `user_dcd_${sufijo}`, 'dueno');
    await usuario(randomUUID(), empresa, `user_dcv_${sufijo}`, 'operador', '{"registrar_ventas": true}');
    await suscripcionActiva(db, empresa, 'basico');
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [otra, `Otra ${sufijo}`, `org_dco_${sufijo}`]);
    const otroDueno = randomUUID();
    await usuario(otroDueno, otra, `user_dco_${sufijo}`, 'dueno');
    await suscripcionActiva(db, otra, 'basico');

    const producto = randomUUID();
    await db.query(`INSERT INTO productos (id, empresa_id, nombre) VALUES ($1, $2, 'Mate imperial')`, [producto, empresa]);
    await db.query(`INSERT INTO clientes (id, empresa_id, nombre, email, telefono) VALUES ($1, $2, 'Lucía Gómez', $3, '261 555-1234')`, [cliente, empresa, `lucia_${sufijo}@e2e.test`]);
    // Venta de $50.000 con descuento de $4.000, señada: debe $20.000.
    await db.query(
      `INSERT INTO ventas (id, empresa_id, usuario_id, numero_venta, forma_pago, descuento, total_con_interes, cliente_id, es_senia, monto_senia, saldo_pendiente, estado_cobro)
       VALUES ($1, $2, $3, 'V-000077', 'efectivo', 4000, 50000, $4, true, 30000, 20000, 'señado')`,
      [venta, empresa, dueno, cliente],
    );
    await db.query(`INSERT INTO ventas_items (id, empresa_id, venta_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4, 2, 27000)`, [randomUUID(), empresa, venta, producto]);
    // Dos pagos del saldo y uno anulado.
    for (const [i, id] of cobros.entries()) {
      await db.query(`INSERT INTO cobros_clientes (id, empresa_id, cliente_id, monto, forma_pago, fecha, usuario_id, anulado_at) VALUES ($1, $2, $3, 10000, 'transferencia', now() - ($4 || ' hours')::interval, $5, $6)`, [
        id, empresa, cliente, String(3 - i), dueno, i === 2 ? new Date() : null,
      ]);
      await db.query(`INSERT INTO cobros_aplicaciones (id, cobro_id, venta_id, monto) VALUES ($1, $2, $3, 10000)`, [randomUUID(), id, venta]);
    }
    const productoOtra = randomUUID();
    await db.query(`INSERT INTO productos (id, empresa_id, nombre) VALUES ($1, $2, 'Termo')`, [productoOtra, otra]);
    await db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, numero_venta, forma_pago, total_con_interes) VALUES ($1, $2, $3, 'V-000001', 'efectivo', 9000)`, [ventaOtra, otra, otroDueno]);
    await db.query(`INSERT INTO ventas_items (id, empresa_id, venta_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4, 1, 9000)`, [randomUUID(), otra, ventaOtra, productoOtra]);

    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
    vi.restoreAllMocks();
  });

  const api = () => request(app.getHttpServer());
  const esPdf = (r: request.Response) => {
    expect(r.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(r.body).subarray(0, 5).toString()).toBe('%PDF-');
  };
  const binario = (r: request.Request) => r.buffer(true).parse((res, cb) => {
    const partes: Buffer[] = [];
    res.on('data', (c: Buffer) => partes.push(c));
    res.on('end', () => cb(null, Buffer.concat(partes)));
  });

  it('el vendedor genera el comprobante de venta en PDF', async () => {
    const r = await binario(api().get(`/documentos/venta/${venta}/pdf`).set(VENDEDOR)).expect(200);
    esPdf(r);
    expect(r.headers['content-disposition']).toContain('comprobante-V-000077.pdf');
  });

  it('otra empresa no ve los documentos ajenos', async () => {
    await api().get(`/documentos/venta/${venta}/pdf`).set(AJENO).expect(404);
    await api().get(`/documentos/recibo/${cobros[0]}/pdf`).set(AJENO).expect(404);
    await api().get(`/documentos/venta/${ventaOtra}/pdf`).set(DUENO).expect(404);
  });

  it('los recibos se numeran la primera vez y mantienen el número', async () => {
    const antes = await api().get(`/documentos/venta/${venta}/cobros`).set(DUENO).expect(200);
    expect(antes.body.map((c: { id: string }) => c.id)).toEqual([cobros[0], cobros[1]]);
    expect(antes.body.every((c: { recibo: string | null }) => c.recibo === null)).toBe(true);

    const r1 = await binario(api().get(`/documentos/recibo/${cobros[1]}/pdf`).set(DUENO)).expect(200);
    esPdf(r1);
    expect(r1.headers['content-disposition']).toContain('recibo-R-000001.pdf');
    await binario(api().get(`/documentos/recibo/${cobros[0]}/pdf`).set(DUENO)).expect(200);
    const r1bis = await binario(api().get(`/documentos/recibo/${cobros[1]}/pdf`).set(DUENO)).expect(200);
    expect(r1bis.headers['content-disposition']).toContain('recibo-R-000001.pdf');

    const despues = await api().get(`/documentos/venta/${venta}/cobros`).set(DUENO).expect(200);
    expect(despues.body.map((c: { recibo: string }) => c.recibo)).toEqual(['R-000002', 'R-000001']);
  });

  it('un cobro anulado no tiene recibo', async () => {
    const r = await api().get(`/documentos/recibo/${cobros[2]}/pdf`).set(DUENO).expect(400);
    expect(r.body.message).toContain('anulado');
  });

  it('el link para WhatsApp abre el PDF sin sesión y no se puede adulterar', async () => {
    const r = await api().post(`/documentos/venta/${venta}/link`).set(VENDEDOR).expect(201);
    expect(r.body.telefono).toBe('5492615551234');
    expect(r.body.mensaje).toContain('Hola Lucía!');
    expect(r.body.mensaje).toContain('V-000077');
    expect(r.body.whatsapp).toMatch(/^https:\/\/wa\.me\/5492615551234\?text=/);
    const ruta = new URL(r.body.url).pathname;
    expect(ruta).toMatch(/^\/documentos\/ver\//);
    esPdf(await binario(api().get(ruta)).expect(200));
    const [datos, firma] = ruta.slice('/documentos/ver/'.length).split('.');
    const otraVenta = Buffer.from(JSON.stringify([otra, 'venta', ventaOtra, '2099-01-01'])).toString('base64url');
    await api().get(`/documentos/ver/${otraVenta}.${firma}`).expect(404);
    expect(datos).toBeTruthy();
  });

  it('el email va al cliente con el PDF adjunto y las respuestas al negocio', async () => {
    await api().patch('/configuracion').set(DUENO).send({ remitente: { nombre: 'Mates del Sur', direccion: null, telefono: null, email: `ventas_${sufijo}@e2e.test` } }).expect(200);
    const r = await api().post(`/documentos/venta/${venta}/email`).set(DUENO).send({ email: null }).expect(201);
    expect(r.body.para).toBe(`lucia_${sufijo}@e2e.test`);
    const e = emails.at(-1)!;
    expect(e.to).toEqual([`lucia_${sufijo}@e2e.test`]);
    expect(e.subject).toBe('Comprobante de venta V-000077 · Mates del Sur');
    expect(e.reply_to).toBe(`ventas_${sufijo}@e2e.test`);
    expect(e.attachments[0].filename).toBe('comprobante-V-000077.pdf');
    await api().post(`/documentos/recibo/${cobros[0]}/email`).set(DUENO).send({ email: 'no-es-un-email' }).expect(400);
  });

  it('solo el dueño cambia la configuración', async () => {
    await api().patch('/documentos/config').set(VENDEDOR).send({ pie: 'Hola' }).expect(403);
    const r = await api().patch('/documentos/config').set(DUENO).send({ pie: 'Gracias por tu compra', validezPresupuestoDias: 10 }).expect(200);
    expect(r.body).toMatchObject({ pie: 'Gracias por tu compra', validezPresupuestoDias: 10, logoUrl: null });
    esPdf(await binario(api().get(`/documentos/venta/${venta}/pdf`).set(DUENO)).expect(200));
  });
});
