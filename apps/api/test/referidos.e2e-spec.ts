// Referidos de punta a punta: código propio, registro con el código (30 días y 10%),
// premio para el que recomienda al primer pago del nuevo, descuento en su próximo
// pago, tope de 6 por año y devoluciones.
//
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts referidos
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
const dias = (n: number) => new Date(Date.parse(`${hoy}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

describe.skipIf(!URL_E2E)('Referidos (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const bearer = (user: string, org = '') => ({ Authorization: `Bearer ${user}|${org}` });
  const ADMIN = bearer(`user_radmin_${sufijo}`, `org_radmin_${sufijo}`);
  const REFERENTE = bearer(`user_ref_${sufijo}`, `org_ref_${sufijo}`);
  const referente = randomUUID();
  let codigo = '';
  const s = () => app.getHttpServer();

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    for (const nombre of ['basico', 'pro', 'ecommerce']) {
      await db.query(`INSERT INTO planes (id, nombre) SELECT gen_random_uuid(), $1 WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = $1)`, [nombre]);
    }
    const adminEmpresa = randomUUID();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, 'Admin', $2)`, [adminEmpresa, `org_radmin_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Admin', $3, $4, 'dueno')`, [randomUUID(), adminEmpresa, `radmin_${sufijo}@e2e.test`, `user_radmin_${sufijo}`]);
    await suscripcionActiva(db, adminEmpresa);
    await db.query(`INSERT INTO admin_emails (email) VALUES ($1)`, [`radmin_${sufijo}@e2e.test`]);
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id, cuit) VALUES ($1, $2, $3, $4)`, [referente, `Ñandú Mates ${sufijo}`, `org_ref_${sufijo}`, `27${String(Date.now()).slice(-8)}1`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Ana', $3, $4, 'dueno')`, [randomUUID(), referente, `ref_${sufijo}@e2e.test`, `user_ref_${sufijo}`]);
    await suscripcionActiva(db, referente, 'basico');

    const { AppModule } = await import('../src/app.module.js');
    const { ClerkCuentasService } = await import('../src/modules/registro/clerk-cuentas.service.js');
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClerkCuentasService)
      .useValue({
        usuario: async (id: string) => ({ email: `${id}@e2e.test`, nombre: 'Emprendedor' }),
        crearOrganizacion: async (_nombre: string, id: string) => `org_${id}`,
        bloquearCrearOrganizaciones: async () => {},
        borrarOrganizacion: async () => {},
      })
      .compile();
    app = modulo.createNestApplication();
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const registrar = (user: string, cod: string | null) =>
    request(s()).post('/registro').set(bearer(user)).send({ nombreNegocio: `Negocio ${user}`, rubro: 'Otro', telefono: '2615469432', aceptaTerminos: true, codigo: cod });
  const pagar = (empresaId: string, plan = 'pro') => request(s()).post('/admin/pagos').set(ADMIN).send({ empresaId, plan, ciclo: 'mensual', metodo: 'transferencia' }).expect(201);
  const resumen = async () => (await request(s()).get('/referidos').set(REFERENTE).expect(200)).body;

  it('cada cliente tiene su código (se crea una vez) y el link para compartir', async () => {
    const r = await resumen();
    expect(r.codigo).toMatch(/^NANDU-[A-HJKMNP-Z2-9]{3}$/);
    expect(r.link).toContain(`/sign-up?codigo=${r.codigo}`);
    expect(r.reglas).toEqual({ diasPrueba: 30, descuentoNuevoPct: 10, premioPct: 10, maxPorAnio: 6 });
    expect((await resumen()).codigo).toBe(r.codigo);
    codigo = r.codigo;
  });

  it('nadie puede usar su propio código', async () => {
    const v = await request(s()).get(`/registro/codigo?codigo=${codigo}`).set(bearer(`user_ref_${sufijo}`)).expect(200);
    expect(v.body).toMatchObject({ ok: false });
    expect(v.body.mensaje).toContain('tu propio código');
  });

  let nuevo = '';
  it('el nuevo se registra con el código: 30 días de prueba', async () => {
    const r = await registrar(`user_nuevo1_${sufijo}`, codigo.toLowerCase()).expect(201);
    nuevo = r.body.empresaId;
    expect(r.body.finPrueba).toBe(dias(30));
    expect((await resumen()).recomendados).toEqual([{ nombre: `Negocio user_nuevo1_${sufijo}`, desde: expect.any(String), estado: 'en_prueba', premio: null }]);
  });

  it('su primer pago tiene 10% menos y el que recomendó gana su premio', async () => {
    const r = await pagar(nuevo);
    expect(r.body.pago).toMatchObject({ monto: 80_100, tipo: 'entrada' });
    const res = await resumen();
    expect(res.premios).toMatchObject({ disponibles: 1, pctProximoPago: 10, usados: 0 });
    expect(res.recomendados[0]).toMatchObject({ estado: 'pago', premio: 'disponible' });
    // El segundo pago del nuevo no genera otro premio.
    await pagar(nuevo);
    expect((await resumen()).premios.disponibles).toBe(1);
  });

  it('el que recomendó paga 10% menos su próximo período y el premio queda usado', async () => {
    const c = await request(s()).post('/admin/pagos/cotizar').set(ADMIN).send({ empresaId: referente, plan: 'basico', ciclo: 'mensual' }).expect(200);
    expect(c.body.cotizacion).toMatchObject({ total: 44_100, referidosPct: 10 });
    const r = await pagar(referente, 'basico');
    expect(r.body.pago).toMatchObject({ monto: 44_100, referidosPct: 10 });
    expect((await resumen()).premios).toMatchObject({ disponibles: 0, pctProximoPago: 0, usados: 1 });
    // Y el siguiente ya es a precio normal.
    expect((await pagar(referente, 'basico')).body.pago.monto).toBe(49_000);
  });

  it('si se devuelve el pago donde se usó, el premio vuelve a estar disponible', async () => {
    const pagoUso = (await db.query(`SELECT pago_uso_id FROM premios_referidos WHERE empresa_referida_id = $1`, [nuevo])).rows[0].pago_uso_id;
    await request(s()).post(`/admin/pagos/${pagoUso}/devolver`).set(ADMIN).send({ motivo: 'prueba' }).expect(200);
    expect((await resumen()).premios).toMatchObject({ disponibles: 1, usados: 0 });
  });

  it('si se devuelve el primer pago de un recomendado antes de usar el premio, se anula', async () => {
    const r = await registrar(`user_nuevo2_${sufijo}`, codigo).expect(201);
    const pago = (await pagar(r.body.empresaId)).body.pago.id;
    expect((await resumen()).premios.disponibles).toBe(2);
    await request(s()).post(`/admin/pagos/${pago}/devolver`).set(ADMIN).send({ motivo: 'prueba' }).expect(200);
    const res = await resumen();
    expect(res.premios.disponibles).toBe(1);
    expect(res.recomendados.find((x: { nombre: string }) => x.nombre.includes('nuevo2'))).toMatchObject({ estado: 'devuelto', premio: 'anulado' });
    // Si vuelve a pagar, el premio se recupera.
    await pagar(r.body.empresaId);
    expect((await resumen()).premios.disponibles).toBe(2);
  });

  it('tope: como mucho 6 premios por año; los que pasan quedan fuera', async () => {
    for (const n of [3, 4, 5, 6, 7]) {
      const r = await registrar(`user_nuevo${n}_${sufijo}`, codigo).expect(201);
      await pagar(r.body.empresaId);
    }
    const res = await resumen();
    expect(res.premios).toMatchObject({ delAnio: 6, fueraDeTope: 1, disponibles: 6, pctProximoPago: 60 });
  });
});
