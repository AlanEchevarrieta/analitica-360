// Alianzas con cámaras de punta a punta (AppModule completo, guards reales):
// registro con UCIM360 → mes gratis → plan anual con descuento → pago →
// la comisión aparece en la liquidación del mes. También: mes gratis de un
// solo uso, trimestral en 3 cuotas, devolución y seguridad (403 para no admin).
//
// Necesita una base DESCARTABLE con las migraciones aplicadas (trae la UCIM):
//   docker run -d --name pg-e2e -e POSTGRES_PASSWORD=e2e -p 5499:5432 postgres:16
//   DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec prisma migrate deploy
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts alianzas
// Sin E2E_DATABASE_URL se saltea (nunca toca la base de desarrollo).
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const URL_E2E = process.env.E2E_DATABASE_URL;

// Token de prueba "<clerkUserId>|<clerkOrgId>" (org vacía = todavía sin empresa).
vi.mock('@clerk/backend', async (original) => ({
  ...(await original<typeof import('@clerk/backend')>()),
  verifyToken: async (token: string) => {
    const [sub, org] = token.split('|');
    return { sub, o: org ? { id: org } : undefined };
  },
}));

const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // día de Argentina
const mesActual = hoy.slice(0, 7);
const dias = (n: number) => new Date(Date.parse(`${hoy}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const sufijo = randomUUID().slice(0, 8);

describe.skipIf(!URL_E2E)('Alianzas: UCIM360 de punta a punta (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  let camaraId: string;
  const emails = new Map<string, string>();
  const bearer = (user: string, org = '') => ({ Authorization: `Bearer ${user}|${org}` });
  const ADMIN = bearer(`user_admin_${sufijo}`, `org_admin_${sufijo}`);

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    camaraId = (await db.query(`SELECT id FROM camaras WHERE nombre = 'UCIM'`)).rows[0].id;
    // Planes (en una base vacía no los trae la migración de datos).
    for (const nombre of ['basico', 'pro', 'ecommerce']) {
      await db.query(`INSERT INTO planes (id, nombre) SELECT gen_random_uuid(), $1 WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = $1)`, [nombre]);
    }
    // Admin de la app: empresa propia + usuario cuyo email está en admin_emails.
    const adminEmpresa = randomUUID();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, 'Analítica 360 E2E', $2)`, [adminEmpresa, `org_admin_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Admin', $3, $4, 'dueno')`, [randomUUID(), adminEmpresa, `admin_${sufijo}@e2e.test`, `user_admin_${sufijo}`]);
    await db.query(`INSERT INTO suscripciones (id, empresa_id, estado, fecha_vencimiento) VALUES ($1, $2, 'activa', '2099-01-01')`, [randomUUID(), adminEmpresa]);
    await db.query(`INSERT INTO admin_emails (email) VALUES ($1)`, [`admin_${sufijo}@e2e.test`]);

    const { AppModule } = await import('../src/app.module.js');
    const { ClerkCuentasService } = await import('../src/modules/registro/clerk-cuentas.service.js');
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClerkCuentasService)
      .useValue({
        usuario: async (id: string) => ({ email: emails.get(id) ?? `${id}@e2e.test`, nombre: 'Emprendedor' }),
        crearOrganizacion: async (_nombre: string, id: string) => `org_${id}`,
        bloquearCrearOrganizaciones: async () => {},
        borrarOrganizacion: async () => {},
      })
      .compile();
    app = modulo.createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const registrar = (user: string, codigo: string | null, extra: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/registro')
      .set(bearer(user))
      .send({ nombreNegocio: `Negocio ${user}`, rubro: 'Otro', telefono: '2615469432', aceptaTerminos: true, codigo, ...extra });

  let empresa1: string;
  const user1 = `user_uno_${sufijo}`;

  it('registro con "ucim 360": 1 mes gratis (30 días) y queda marcado que viene por la UCIM', async () => {
    emails.set(user1, `uno_${sufijo}@e2e.test`);
    const res = await registrar(user1, 'ucim 360', { cuit: '20-12345678-9' }).expect(201);
    empresa1 = res.body.empresaId;
    expect(res.body.finPrueba).toBe(dias(30));
    expect(res.body.cupon).toMatchObject({ codigo: 'UCIM360', camara: 'UCIM', mesGratis: true, diasPrueba: 30, aviso: null });
    const e = (await db.query(`SELECT camara_id, cuit, prueba_hasta::text FROM empresas WHERE id = $1`, [empresa1])).rows[0];
    expect(e).toEqual({ camara_id: camaraId, cuit: '20123456789', prueba_hasta: dias(30) });
  });

  it('sin código: la prueba común de 14 días', async () => {
    const res = await registrar(`user_sincodigo_${sufijo}`, null).expect(201);
    expect(res.body.finPrueba).toBe(dias(14));
    expect(res.body.cupon).toBeNull();
  });

  it('código inexistente: se avisa con un mensaje claro y no se crea nada', async () => {
    const res = await registrar(`user_malo_${sufijo}`, 'NOEXISTE').expect(400);
    expect(res.body.message).toMatch(/no existe/);
  });

  it('segundo intento con el mismo email: sin mes gratis, pero queda de la UCIM con sus descuentos', async () => {
    const user2 = `user_dos_${sufijo}`;
    emails.set(user2, `UNO_${sufijo}@e2e.test`); // mismo email, otro usuario de Clerk (y en mayúsculas)
    const res = await registrar(user2, 'UCIM360').expect(201);
    expect(res.body.finPrueba).toBe(dias(14));
    expect(res.body.cupon).toMatchObject({ mesGratis: false, diasPrueba: 14 });
    expect(res.body.cupon.aviso).toMatch(/no corresponde el mes gratis/);
    const precios = await request(app.getHttpServer()).get('/suscripcion/precios').set(bearer(user2, `org_${user2}`)).expect(200);
    const anual = precios.body.planes.find((p: { plan: string }) => p.plan === 'basico').ciclos.find((c: { ciclo: string }) => c.ciclo === 'anual');
    expect(anual.primerPago.total).toBe(441_000);
  });

  it('mismo CUIT con otro email y usuario: tampoco recibe el mes gratis', async () => {
    const user3 = `user_tres_${sufijo}`;
    const res = await registrar(user3, 'UCIM360', { cuit: '20123456789' }).expect(201);
    expect(res.body.cupon.mesGratis).toBe(false);
  });

  it('el emprendedor ve en Planes el mes gratis, la lista, el primer pago con descuento y la renovación', async () => {
    const res = await request(app.getHttpServer()).get('/suscripcion/precios').set(bearer(user1, `org_${user1}`)).expect(200);
    expect(res.body.cupon).toMatchObject({ codigo: 'UCIM360', aplicado: true });
    const basico = res.body.planes.find((p: { plan: string }) => p.plan === 'basico');
    const ciclo = (c: string) => basico.ciclos.find((x: { ciclo: string }) => x.ciclo === c);
    expect(ciclo('anual')).toMatchObject({ lista: 588_000, primerPago: { total: 441_000 }, renovacion: { total: 470_400 } });
    expect(ciclo('trimestral')).toMatchObject({ lista: 147_000, primerPago: { total: 88_200, cuotas: 3, montoCuota: 29_400 }, renovacion: { total: 147_000 } });
    expect(ciclo('mensual')).toMatchObject({ lista: 49_000, primerPago: { total: 49_000 } });
  });

  let pagoAnual: string;

  it('elige el plan anual: el admin cobra 441.000 (75% de 588.000) y se genera la comisión del cliente n.º 1 al 20%', async () => {
    const cot = await request(app.getHttpServer()).post('/admin/pagos/cotizar').set(ADMIN).send({ empresaId: empresa1, plan: 'basico', ciclo: 'anual' }).expect(200);
    expect(cot.body).toMatchObject({ monto: 441_000, precioLista: 588_000, cotizacion: { tipo: 'entrada' } });
    const res = await request(app.getHttpServer()).post('/admin/pagos').set(ADMIN).send({ empresaId: empresa1, plan: 'basico', ciclo: 'anual', metodo: 'transferencia', desde: dias(30) }).expect(201);
    pagoAnual = res.body.pago.id;
    expect(res.body.pago).toMatchObject({ monto: 441_000, descuento: 147_000, tipo: 'entrada' });
    expect(res.body.comision).toMatchObject({ monto: 88_200, porcentaje: 20, orden: 1, mes: `${mesActual}-01` });
    const e = (await db.query(`SELECT orden_camara, comision_pct::float, comision_hasta::text FROM empresas WHERE id = $1`, [empresa1])).rows[0];
    expect(e.orden_camara).toBe(1);
    expect(e.comision_pct).toBe(20);
  });

  it('la comisión aparece en la liquidación del mes; se aprueba y se marca pagada', async () => {
    const liq = await request(app.getHttpServer()).get('/admin/alianzas/liquidaciones').query({ camaraId, mes: mesActual }).set(ADMIN).expect(200);
    expect(liq.body.estado).toBe('pendiente');
    expect(liq.body.total).toBe(88_200);
    expect(liq.body.lineas).toHaveLength(1);
    const ok = await request(app.getHttpServer()).post('/admin/alianzas/liquidaciones/aprobar').set(ADMIN).send({ camaraId, mes: mesActual }).expect(200);
    await request(app.getHttpServer()).post(`/admin/alianzas/liquidaciones/${ok.body.id}/pagar`).set(ADMIN).send({ fecha: hoy, referencia: 'TRF-0001' }).expect(200);
    const pagada = await request(app.getHttpServer()).get('/admin/alianzas/liquidaciones').query({ camaraId, mes: mesActual }).set(ADMIN).expect(200);
    expect(pagada.body).toMatchObject({ estado: 'pagada', referencia: 'TRF-0001' });
  });

  it('devolución: ajuste en negativo, que va al próximo mes abierto porque este ya está liquidado', async () => {
    const res = await request(app.getHttpServer()).post(`/admin/pagos/${pagoAnual}/devolver`).set(ADMIN).send({ motivo: 'Se arrepintió' }).expect(200);
    expect(res.body.ajuste.monto).toBe(-88_200);
    expect(res.body.ajuste.mes > `${mesActual}-01`).toBe(true);
  });

  it('trimestral en 3 cuotas de 29.400: cada cuota genera su comisión (cliente n.º 2)', async () => {
    const user4 = `user_cuatro_${sufijo}`;
    const r = await registrar(user4, 'UCIM360').expect(201);
    const empresa4 = r.body.empresaId;
    const cuotas: number[] = [];
    let grupoId: string | undefined;
    for (let i = 0; i < 3; i++) {
      const body = grupoId ? { empresaId: empresa4, plan: 'basico', ciclo: 'trimestral', metodo: 'efectivo', grupoId } : { empresaId: empresa4, plan: 'basico', ciclo: 'trimestral', metodo: 'efectivo', enCuotas: true };
      const res = await request(app.getHttpServer()).post('/admin/pagos').set(ADMIN).send(body).expect(201);
      grupoId = res.body.pago.grupoId;
      cuotas.push(res.body.pago.monto);
      expect(res.body.pago).toMatchObject({ cuota: i + 1, cuotas: 3 });
      expect(res.body.comision).toMatchObject({ orden: 2, porcentaje: 20, monto: 5_880 });
    }
    expect(cuotas).toEqual([29_400, 29_400, 29_400]);
    await request(app.getHttpServer()).post('/admin/pagos').set(ADMIN).send({ empresaId: empresa4, plan: 'basico', ciclo: 'trimestral', metodo: 'efectivo', grupoId }).expect(400);
  });

  it('la ficha de la cámara muestra registros, conversión, tramo y clientes', async () => {
    const res = await request(app.getHttpServer()).get(`/admin/alianzas/camaras/${camaraId}`).set(ADMIN).expect(200);
    expect(res.body.indicadores).toMatchObject({ convertidos: 2, tramo: { clientesConNumero: 2, porcentaje: 20, faltanParaSiguiente: 48 } });
    expect(res.body.indicadores.registros).toBeGreaterThanOrEqual(4);
    expect(res.body.clientes.find((c: { empresaId: string }) => c.empresaId === empresa1)).toMatchObject({ orden: 1, porcentaje: 20 });
  });

  it('seguridad: un emprendedor (no admin) recibe 403 en comisiones, liquidaciones, cámaras y pagos', async () => {
    const yo = bearer(user1, `org_${user1}`);
    await request(app.getHttpServer()).get('/admin/alianzas/camaras').set(yo).expect(403);
    await request(app.getHttpServer()).get(`/admin/alianzas/camaras/${camaraId}`).set(yo).expect(403);
    await request(app.getHttpServer()).get('/admin/alianzas/liquidaciones').query({ camaraId, mes: mesActual }).set(yo).expect(403);
    await request(app.getHttpServer()).get('/admin/alianzas/resumen').set(yo).expect(403);
    await request(app.getHttpServer()).post('/admin/pagos').set(yo).send({}).expect(403);
  });

  it('código cargado después del registro, durante la prueba: la prueba pasa a 1 mes desde el alta', async () => {
    const user5 = `user_cinco_${sufijo}`;
    await registrar(user5, null).expect(201);
    const res = await request(app.getHttpServer()).post('/suscripcion/codigo').set(bearer(user5, `org_${user5}`)).send({ codigo: 'Ucim360' }).expect(200);
    expect(res.body).toMatchObject({ codigo: 'UCIM360', camara: 'UCIM', pruebaHasta: dias(30) });
    await request(app.getHttpServer()).post('/suscripcion/codigo').set(bearer(user5, `org_${user5}`)).send({ codigo: 'UCIM360' }).expect(409);
  });
});
