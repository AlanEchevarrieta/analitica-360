// Factura electrónica (ARCA) de punta a punta con ARCA simulado: configuración, verificación,
// Factura C de una venta (una sola), receptor con CUIT, rechazo de ARCA explicado, dos facturas
// a la vez con números distintos, nota de crédito y PDF, envío por email y lo facturado en el monotributo.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts facturacion
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

/** ARCA de mentira: numera por CUIT, punto de venta y tipo, y puede rechazar a pedido. */
class ArcaFalso {
  configurado = true;
  ambiente = 'homologacion' as const;
  ultimos = new Map<string, number>();
  rechazar: string | null = null;
  pedidos: { cuit: string; tipo: number; numero: number; docTipo: number; total: number }[] = [];
  async funciona() {
    return true;
  }
  async ultimoAutorizado(cuit: string, pv: number, tipo: number) {
    await new Promise((r) => setTimeout(r, 30)); // como la red: deja lugar a que se crucen dos pedidos
    return this.ultimos.get(`${cuit}:${pv}:${tipo}`) ?? 0;
  }
  async solicitarCAE(cuit: string, d: { tipo: number; puntoVenta: number; numero: number; docTipo: number; total: number }) {
    if (this.rechazar) return { aprobado: false as const, errores: [this.rechazar] };
    const clave = `${cuit}:${d.puntoVenta}:${d.tipo}`;
    if (d.numero !== (this.ultimos.get(clave) ?? 0) + 1) return { aprobado: false as const, errores: ['10016: El numero de comprobante no es el proximo a autorizar'] };
    this.ultimos.set(clave, d.numero);
    this.pedidos.push({ cuit, tipo: d.tipo, numero: d.numero, docTipo: d.docTipo, total: d.total });
    return { aprobado: true as const, cae: `7612345678${String(d.numero).padStart(4, '0')}`, vence: '2026-12-31', observaciones: [] };
  }
}

describe.skipIf(!URL_E2E)('Factura electrónica ARCA (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const arca = new ArcaFalso();
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const dueno = randomUUID();
  const producto = randomUUID();
  const DUENO = { Authorization: `Bearer user_fcd_${sufijo}|org_fc_${sufijo}` };
  const VENDEDOR = { Authorization: `Bearer user_fcv_${sufijo}|org_fc_${sufijo}` };
  const ventas: string[] = [];
  const cliente = randomUUID();
  /** Emails que se mandaron por Resend (simulado). */
  const emails: { to: string[]; subject: string; attachments: { filename: string; content: string }[] }[] = [];
  const CUIT = '20123456786';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    process.env.RESEND_API_KEY = 're_e2e';
    // Resend simulado: el resto de las llamadas siguen igual.
    const original = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).startsWith('https://api.resend.com/')) {
        emails.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ id: 'email-e2e' }), { status: 200 });
      }
      return original(url, init);
    });
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `Factura ${sufijo}`, `org_fc_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueña', $3, $4, 'dueno')`, [dueno, empresa, `fcd_${sufijo}@e2e.test`, `user_fcd_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol, permisos) VALUES ($1, $2, 'Vendedor', $3, $4, 'operador', '{"registrar_ventas": true}')`, [randomUUID(), empresa, `fcv_${sufijo}@e2e.test`, `user_fcv_${sufijo}`]);
    await suscripcionActiva(db, empresa, 'pro');
    await db.query(`INSERT INTO productos (id, empresa_id, nombre) VALUES ($1, $2, 'Mate imperial')`, [producto, empresa]);
    await db.query(`INSERT INTO clientes (id, empresa_id, nombre, email) VALUES ($1, $2, 'Lucía', $3)`, [cliente, empresa, `lucia_${sufijo}@e2e.test`]);
    for (const total of [38_000, 12_500, 9_900, 4_000]) {
      const v = randomUUID();
      await db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, forma_pago, total_con_interes, cliente_id) VALUES ($1, $2, $3, 'efectivo', $4, $5)`, [v, empresa, dueno, total, total === 38_000 ? cliente : null]);
      await db.query(`INSERT INTO ventas_items (id, empresa_id, venta_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4, 1, $5)`, [randomUUID(), empresa, v, producto, total]);
      ventas.push(v);
    }
    const { AppModule } = await import('../src/app.module.js');
    const { ArcaCliente } = await import('../src/modules/arca/arca.cliente.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ArcaCliente).useValue(arca).compile()).createNestApplication();
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const facturar = (venta: string, receptor: unknown = null, headers = DUENO) => request(app.getHttpServer()).post(`/facturacion/ventas/${venta}`).set(headers).send({ receptor });

  it('sin configurar, pide cargar los datos', async () => {
    const r = await facturar(ventas[0]).expect(400);
    expect(r.body.message).toContain('Configuración → Impuestos y facturación');
  });

  it('la dueña configura y verifica; el vendedor no puede configurar; el CUIT se controla', async () => {
    const config = { cuit: '20-12345678-6', razonSocial: 'Mates del Sur', domicilio: 'San Martín 100, Mendoza', inicioActividades: '2020-03-01', iibb: '0123', puntoVenta: 2 };
    await request(app.getHttpServer()).put('/facturacion/config').set(VENDEDOR).send(config).expect(403);
    await request(app.getHttpServer()).put('/facturacion/config').set(DUENO).send({ ...config, cuit: '20-12345678-0' }).expect(400);
    await request(app.getHttpServer()).put('/facturacion/config').set(DUENO).send(config).expect(200);
    const v = await request(app.getHttpServer()).post('/facturacion/verificar').set(DUENO).expect(201);
    expect(v.body).toEqual({ ok: true, ultimoNumero: 0 });
  });

  it('Factura C a consumidor final, una sola por venta', async () => {
    const r = await facturar(ventas[0]).expect(201);
    expect(r.body).toMatchObject({ nombre: 'Factura C', numero: '00002-00000001', total: 38_000, prueba: true });
    expect(arca.pedidos.at(-1)).toMatchObject({ cuit: CUIT, tipo: 11, docTipo: 99 });
    await facturar(ventas[0]).expect(409);
  });

  it('el vendedor puede facturar, a un cliente con CUIT (que se controla)', async () => {
    await facturar(ventas[1], { docTipo: 80, docNro: '20-12345678-0', nombre: 'Kiosco', condicionIva: 6 }, VENDEDOR).expect(400);
    const r = await facturar(ventas[1], { docTipo: 80, docNro: '20-12345678-6', nombre: 'Kiosco', condicionIva: 6 }, VENDEDOR).expect(201);
    expect(r.body).toMatchObject({ numero: '00002-00000002', receptorNombre: 'Kiosco' });
  });

  it('si ARCA rechaza, se explica y no se guarda nada', async () => {
    arca.rechazar = '600: ValidacionDeToken: No aparecio CUIT en lista de relaciones';
    const r = await facturar(ventas[2]).expect(400);
    expect(r.body.message).toContain('falta delegar el servicio');
    arca.rechazar = null;
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM comprobantes WHERE venta_id = $1`, [ventas[2]]);
    expect(rows[0].n).toBe(0);
  });

  it('dos facturas a la vez salen con números distintos', async () => {
    const [a, b] = await Promise.all([facturar(ventas[2]), facturar(ventas[3])]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect([a.body.numero, b.body.numero].sort()).toEqual(['00002-00000003', '00002-00000004']);
  });

  it('nota de crédito que anula una factura (una sola) y PDF con QR', async () => {
    const [f] = (await request(app.getHttpServer()).get(`/facturacion/ventas/${ventas[0]}`).set(DUENO).expect(200)).body;
    await request(app.getHttpServer()).post(`/facturacion/comprobantes/${f.id}/nota-credito`).set(VENDEDOR).expect(403);
    const nc = await request(app.getHttpServer()).post(`/facturacion/comprobantes/${f.id}/nota-credito`).set(DUENO).expect(201);
    expect(nc.body).toMatchObject({ nombre: 'Nota de crédito C', numero: '00002-00000001', total: 38_000, asociadoId: f.id });
    await request(app.getHttpServer()).post(`/facturacion/comprobantes/${f.id}/nota-credito`).set(DUENO).expect(409);
    const pdf = await request(app.getHttpServer()).get(`/facturacion/comprobantes/${f.id}/pdf`).set(DUENO).buffer(true).parse((res, cb) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    }).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('manda la factura por email al cliente de la venta, con el PDF adjunto, y queda registrado', async () => {
    const [f] = (await request(app.getHttpServer()).get(`/facturacion/ventas/${ventas[0]}`).set(DUENO).expect(200)).body;
    expect(f.emailCliente).toBe(`lucia_${sufijo}@e2e.test`);
    const r = await request(app.getHttpServer()).post(`/facturacion/comprobantes/${f.id}/email`).set(VENDEDOR).send({}).expect(200);
    expect(r.body).toMatchObject({ enviadoA: `lucia_${sufijo}@e2e.test`, enviadoEn: expect.any(String) });
    const mail = emails.at(-1)!;
    expect(mail.to).toEqual([`lucia_${sufijo}@e2e.test`]);
    expect(mail.subject).toBe('Factura C 00002-00000001 de Mates del Sur (prueba)');
    expect(mail.attachments[0].filename).toBe('Factura-C-00002-00000001.pdf');
    expect(Buffer.from(mail.attachments[0].content, 'base64').subarray(0, 4).toString()).toBe('%PDF');
  });

  it('a otro email: se valida; una venta sin cliente con email pide escribirlo', async () => {
    const [f] = (await request(app.getHttpServer()).get(`/facturacion/ventas/${ventas[0]}`).set(DUENO).expect(200)).body;
    await request(app.getHttpServer()).post(`/facturacion/comprobantes/${f.id}/email`).set(DUENO).send({ email: 'no-es-un-email' }).expect(400);
    await request(app.getHttpServer()).post(`/facturacion/comprobantes/${f.id}/email`).set(DUENO).send({ email: 'contador@e2e.test' }).expect(200);
    expect(emails.at(-1)!.to).toEqual(['contador@e2e.test']);
    const [sinCliente] = (await request(app.getHttpServer()).get(`/facturacion/ventas/${ventas[1]}`).set(DUENO).expect(200)).body;
    const r = await request(app.getHttpServer()).post(`/facturacion/comprobantes/${sinCliente.id}/email`).set(DUENO).send({}).expect(400);
    expect(r.body.message).toMatch(/escribí a dónde mandarla/);
  });

  it('monotributo: suma lo facturado en producción (la nota de crédito resta) y no las facturas de prueba', async () => {
    const antes = (await request(app.getHttpServer()).get('/monotributo').set(DUENO).expect(200)).body;
    expect(antes.facturadoArca12m).toBeNull(); // las de homologación no cuentan
    const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    const comp = (tipo: number, numero: number, total: number) =>
      db.query(
        `INSERT INTO comprobantes (id, empresa_id, tipo, punto_venta, numero, fecha, total, doc_tipo, doc_nro, condicion_iva_receptor, cae, cae_vence, ambiente) VALUES ($1, $2, $3, 2, $4, $5, $6, 99, '0', 5, '1', $5, 'produccion')`,
        [randomUUID(), empresa, tipo, numero, hoy, total],
      );
    await comp(11, 1, 50_000);
    await comp(11, 2, 20_000);
    await comp(13, 1, 20_000);
    const despues = (await request(app.getHttpServer()).get('/monotributo').set(DUENO).expect(200)).body;
    expect(despues.facturadoArca12m).toBe(50_000);
    expect(despues.meses.at(-1)).toMatchObject({ facturado: 50_000 });
  });
});
