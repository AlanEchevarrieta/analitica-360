// Débito automático con Mercado Pago de punta a punta, con Mercado Pago simulado: activar,
// autorizar, cada cobro (se registra una sola vez), cambio de monto del período siguiente,
// firma de los avisos, permisos y cancelación.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts mercadopago
import { createHmac, randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { suscripcionActiva } from './e2e-helpers.js';

const URL_E2E = process.env.E2E_DATABASE_URL;
const SECRETO = 'secreto-webhook-e2e';

vi.mock('@clerk/backend', async (original) => ({
  ...(await original<typeof import('@clerk/backend')>()),
  verifyToken: async (token: string) => {
    const [sub, org] = token.split('|');
    return { sub, o: org ? { id: org } : undefined };
  },
}));

/** Mercado Pago de mentira: guarda lo que se le pide y responde como la API real. */
class MercadoPagoFalso {
  configurado = true;
  suscripciones = new Map<string, { id: string; status: string; monto: number }>();
  pagos = new Map<string, { id: string; preapproval_id: string; status: string; transaction_amount: number; payment: { status: string } }>();
  cambiosDeMonto: number[] = [];
  async crearSuscripcion(d: { monto: number }) {
    const id = `pre-${randomUUID().slice(0, 8)}`;
    this.suscripciones.set(id, { id, status: 'pending', monto: d.monto });
    return { id, status: 'pending', init_point: `https://mp.test/autorizar/${id}` };
  }
  async suscripcion(id: string) {
    return this.suscripciones.get(id)!;
  }
  async cambiarMonto(id: string, monto: number) {
    this.cambiosDeMonto.push(monto);
    this.suscripciones.get(id)!.monto = monto;
    return this.suscripciones.get(id)!;
  }
  async cancelar(id: string) {
    this.suscripciones.get(id)!.status = 'cancelled';
    return this.suscripciones.get(id)!;
  }
  async pagoAutorizado(id: string) {
    return this.pagos.get(id)!;
  }
}

describe.skipIf(!URL_E2E)('Mercado Pago: débito automático (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const mp = new MercadoPagoFalso();
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const DUENO = { Authorization: `Bearer user_mpd_${sufijo}|org_mp_${sufijo}` };
  const VENDEDOR = { Authorization: `Bearer user_mpv_${sufijo}|org_mp_${sufijo}` };
  let preapproval = '';

  const avisar = (type: string, id: string, firmaOk = true) => {
    const ts = String(Date.now());
    const v1 = createHmac('sha256', firmaOk ? SECRETO : 'otra').update(`id:${id.toLowerCase()};request-id:req-${id};ts:${ts};`).digest('hex');
    return request(app.getHttpServer())
      .post(`/webhooks/mercadopago?data.id=${id}&type=${type}`)
      .set('x-signature', `ts=${ts},v1=${v1}`)
      .set('x-request-id', `req-${id}`)
      .send({ type, data: { id } });
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    process.env.MP_WEBHOOK_SECRET = SECRETO;
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `MP ${sufijo}`, `org_mp_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueña', $3, $4, 'dueno')`, [randomUUID(), empresa, `mpd_${sufijo}@e2e.test`, `user_mpd_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Vendedor', $3, $4, 'operador')`, [randomUUID(), empresa, `mpv_${sufijo}@e2e.test`, `user_mpv_${sufijo}`]);
    await suscripcionActiva(db, empresa, 'pro', 'activa', '2020-01-01'); // vencida: el débito automático la pone al día
    await db.query(`INSERT INTO planes (id, nombre, activo) SELECT gen_random_uuid(), 'pro', true WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = 'pro' AND activo)`);
    const { AppModule } = await import('../src/app.module.js');
    const { MercadoPagoCliente } = await import('../src/modules/mercadopago/mercadopago.cliente.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(MercadoPagoCliente).useValue(mp).compile()).createNestApplication();
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('el vendedor no puede activarlo; la dueña sí y recibe el link para autorizar', async () => {
    await request(app.getHttpServer()).post('/suscripcion/mercadopago').set(VENDEDOR).send({ plan: 'pro', ciclo: 'mensual' }).expect(403);
    const r = await request(app.getHttpServer()).post('/suscripcion/mercadopago').set(DUENO).send({ plan: 'pro', ciclo: 'mensual' }).expect(201);
    expect(r.body.url).toMatch(/^https:\/\/mp\.test\/autorizar\//);
    const e = (await request(app.getHttpServer()).get('/suscripcion/mercadopago').set(DUENO).expect(200)).body;
    expect(e).toMatchObject({ disponible: true, suscripcion: { estado: 'pending', plan: 'pro', ciclo: 'mensual', monto: 89_000 } });
    preapproval = [...mp.suscripciones.keys()][0];
  });

  it('un aviso con firma falsa se rechaza', async () => {
    await avisar('subscription_preapproval', preapproval, false).expect(401);
  });

  it('al autorizar la tarjeta, la suscripción queda autorizada', async () => {
    mp.suscripciones.get(preapproval)!.status = 'authorized';
    await avisar('subscription_preapproval', preapproval).expect(200);
    const e = (await request(app.getHttpServer()).get('/suscripcion/mercadopago').set(DUENO).expect(200)).body;
    expect(e.suscripcion.estado).toBe('authorized');
    await request(app.getHttpServer()).post('/suscripcion/mercadopago').set(DUENO).send({ plan: 'basico', ciclo: 'mensual' }).expect(409);
  });

  it('cada cobro aprobado se registra una sola vez y pone la cuenta al día', async () => {
    mp.pagos.set('7001', { id: '7001', preapproval_id: preapproval, status: 'processed', transaction_amount: 89_000, payment: { status: 'approved' } });
    await avisar('subscription_authorized_payment', '7001').expect(200);
    await avisar('subscription_authorized_payment', '7001').expect(200); // Mercado Pago a veces avisa dos veces
    const { rows } = await db.query(`SELECT monto_ars::float AS monto, metodo, origen, referencia_externa FROM pagos WHERE empresa_id = $1`, [empresa]);
    expect(rows).toEqual([{ monto: 89_000, metodo: 'mercadopago', origen: 'mercadopago', referencia_externa: 'mp-ap:7001' }]);
    const sus = await db.query(`SELECT estado, fecha_vencimiento >= current_date AS al_dia FROM suscripciones WHERE empresa_id = $1`, [empresa]);
    expect(sus.rows.every((s) => s.estado === 'activa' && s.al_dia)).toBe(true);
  });

  it('un cobro rechazado no se registra', async () => {
    mp.pagos.set('7002', { id: '7002', preapproval_id: preapproval, status: 'recycling', transaction_amount: 89_000, payment: { status: 'rejected' } });
    await avisar('subscription_authorized_payment', '7002').expect(200);
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM pagos WHERE empresa_id = $1`, [empresa]);
    expect(rows[0].n).toBe(1);
  });

  it('cancelar lo da de baja en Mercado Pago', async () => {
    await request(app.getHttpServer()).post('/suscripcion/mercadopago/cancelar').set(DUENO).expect(204);
    expect(mp.suscripciones.get(preapproval)!.status).toBe('cancelled');
    const e = (await request(app.getHttpServer()).get('/suscripcion/mercadopago').set(DUENO).expect(200)).body;
    expect(e.suscripcion.estado).toBe('cancelled');
  });
});
