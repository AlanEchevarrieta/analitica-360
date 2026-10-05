// Informes por email de punta a punta (AppModule completo, guards reales):
// configuración, PDF, plan (mensual desde Pro), el programador y la baja.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts informes
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

describe.skipIf(!URL_E2E)('Informes por email (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const empresas: Record<string, string> = {};
  const usuarios: Record<string, string> = {};
  const dueno = (k: string) => ({ Authorization: `Bearer user_inf_${k}_${sufijo}|org_inf_${k}_${sufijo}` });
  const empleado = { Authorization: `Bearer user_inf_emp_${sufijo}|org_inf_pro_${sufijo}` };
  const s = () => app.getHttpServer();
  // Lunes 12/10/2026 a las 9 de Argentina: toca la semana del 05/10 al 11/10 (el mensual de septiembre ya pasó).
  const LUNES = new Date('2026-10-12T09:00:00-03:00');
  // Jueves 01/10/2026 a las 9: toca septiembre.
  const PRIMERO = new Date('2026-10-01T09:00:00-03:00');

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    delete process.env.RESEND_API_KEY;
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    for (const k of ['basico', 'pro']) {
      const id = (empresas[k] = randomUUID());
      await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id, created_at) VALUES ($1, $2, $3, '2026-01-01')`, [id, `Informes ${k} ${sufijo}`, `org_inf_${k}_${sufijo}`]);
      await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueño', $3, $4, 'dueno')`, [(usuarios[k] = randomUUID()), id, `Inf_${k}_${sufijo}@e2e.test`, `user_inf_${k}_${sufijo}`]);
      await suscripcionActiva(db, id, k as 'basico' | 'pro');
    }
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Empleado', $3, $4, 'operador')`, [randomUUID(), empresas.pro, `inf_emp_${sufijo}@e2e.test`, `user_inf_emp_${sufijo}`]);
    // Una venta el viernes 02/10 a las 15 h.
    await db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, forma_pago, fecha, total_sin_interes, total_con_interes) VALUES ($1, $2, $3, 'efectivo', '2026-10-09T18:00:00Z', 15000, 15000)`, [randomUUID(), empresas.pro, usuarios.pro]);
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const servicio = async () => {
    const { InformesService } = await import('../src/modules/informes/informes.service.js');
    return app.get(InformesService);
  };
  const enviados = async (empresa: string) =>
    (await db.query(`SELECT tipo, desde::text, hasta::text, estado, destinatarios, intentos FROM informes_enviados WHERE empresa_id = $1 ORDER BY tipo`, [empresa])).rows;

  it('por defecto: semanal y mensual activados, a los dueños', async () => {
    const r = await request(s()).get('/informes/config').set(dueno('pro')).expect(200);
    expect(r.body).toEqual({ semanal: true, mensual: true, emailsExtra: [], duenos: [`inf_pro_${sufijo}@e2e.test`], bajas: [] });
  });

  it('solo el dueño lo configura', async () => {
    await request(s()).get('/informes/config').set(empleado).expect(403);
    await request(s()).patch('/informes/config').set(empleado).send({ semanal: false }).expect(403);
  });

  it('suma mails extra (válidos, sin repetir) y queda en la bitácora', async () => {
    await request(s()).patch('/informes/config').set(dueno('pro')).send({ emailsExtra: ['no-es-un-email'] }).expect(400);
    const r = await request(s()).patch('/informes/config').set(dueno('pro')).send({ emailsExtra: ['Contador@Estudio.com', 'contador@estudio.com'] }).expect(200);
    expect(r.body.emailsExtra).toEqual(['contador@estudio.com']);
    const bitacora = await db.query(`SELECT count(*)::int AS n FROM registro_auditoria WHERE empresa_id = $1 AND entidad = 'InformesConfig'`, [empresas.pro]);
    expect(bitacora.rows[0].n).toBeGreaterThan(0);
  });

  it('descarga el PDF; el mensual no está en Básico', async () => {
    const r = await request(s()).get('/informes/pdf/semanal').set(dueno('pro')).buffer(true).parse((res, cb) => {
      const partes: Buffer[] = [];
      res.on('data', (b: Buffer) => partes.push(b));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    }).expect(200);
    expect(r.headers['content-type']).toContain('application/pdf');
    expect((r.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    await request(s()).get('/informes/pdf/mensual').set(dueno('pro')).expect(200);
    await request(s()).get('/informes/pdf/semanal').set(dueno('basico')).expect(200);
    const b = await request(s()).get('/informes/pdf/mensual').set(dueno('basico')).expect(403);
    expect(b.body).toMatchObject({ code: 'plan_insuficiente', planMinimo: 'pro' });
    await request(s()).get('/informes/pdf/anual').set(dueno('pro')).expect(400);
  });

  it('los números salen de la base: la venta del viernes está en la semana', async () => {
    const { InformesDatosService } = await import('../src/modules/informes/informes-datos.service.js');
    const d = await app.get(InformesDatosService).armar(empresas.pro, 'semanal', { desde: '2026-10-05', hasta: '2026-10-11' });
    expect(d.ventas.valor).toBe(15000);
    expect(d.cantidad.valor).toBe(1);
    expect(d.dias).toHaveLength(7);
    expect(d.dias.find((x) => x.fecha === '2026-10-09')?.total).toBe(15000);
  });

  it('el programador: el lunes manda el semanal a todos, una sola vez (sin Resend queda "sin_servicio")', async () => {
    const informes = await servicio();
    await informes.ciclo(LUNES);
    await informes.ciclo(LUNES);
    const pro = await enviados(empresas.pro);
    expect(pro).toEqual([{ tipo: 'semanal', desde: '2026-10-05', hasta: '2026-10-11', estado: 'sin_servicio', destinatarios: [`inf_pro_${sufijo}@e2e.test`, 'contador@estudio.com'], intentos: 1 }]);
    expect((await enviados(empresas.basico)).map((f) => f.tipo)).toEqual(['semanal']);
  }, 120_000);

  it('el día 1 manda el mensual solo a Pro', async () => {
    await (await servicio()).ciclo(PRIMERO);
    expect((await enviados(empresas.pro)).map((f) => `${f.tipo} ${f.desde}`)).toEqual(['mensual 2026-09-01', 'semanal 2026-10-05']);
    expect((await enviados(empresas.basico)).map((f) => f.tipo)).toEqual(['semanal']);
  }, 120_000);

  it('si lo apaga, no se manda', async () => {
    await request(s()).patch('/informes/config').set(dueno('basico')).send({ semanal: false }).expect(200);
    await (await servicio()).ciclo(new Date('2026-10-19T09:00:00-03:00'));
    expect((await enviados(empresas.basico)).filter((f) => f.desde === '2026-10-12')).toEqual([]);
    expect((await enviados(empresas.pro)).filter((f) => f.desde === '2026-10-12')).toHaveLength(1);
  }, 120_000);

  it('baja desde el email: con el link firmado sí, con uno tocado no', async () => {
    const { tokenBaja } = await import('../src/modules/informes/informes.util.js');
    const t = tokenBaja('sk_test_e2e', empresas.pro, 'semanal', 'contador@estudio.com');
    const r = await request(s()).get(`/informes/baja?t=${encodeURIComponent(t)}`).expect(200);
    expect(r.text).toContain('no vas a recibir más el informe semanal');
    const malo = await request(s()).get(`/informes/baja?t=${encodeURIComponent(t.slice(0, -2))}xx`).expect(200);
    expect(malo.text).toContain('no es válido');
    const c = await request(s()).get('/informes/config').set(dueno('pro')).expect(200);
    expect(c.body.bajas).toEqual([{ tipo: 'semanal', email: 'contador@estudio.com' }]);
    // El dueño lo puede reactivar.
    const re = await request(s()).patch('/informes/config').set(dueno('pro')).send({ reactivar: 'contador@estudio.com' }).expect(200);
    expect(re.body.bajas).toEqual([]);
  });

  it('enviarme uno de prueba: sin Resend avisa que falta configurarlo', async () => {
    const r = await request(s()).post('/informes/prueba/semanal').set(dueno('pro')).expect(503);
    expect(r.body.message).toContain('descargar el PDF');
  });

  it('historial de envíos para el dueño', async () => {
    const r = await request(s()).get('/informes/historial').set(dueno('pro')).expect(200);
    expect(r.body.length).toBe(3);
    expect(r.body[0]).toMatchObject({ estado: 'sin_servicio' });
  });
});
