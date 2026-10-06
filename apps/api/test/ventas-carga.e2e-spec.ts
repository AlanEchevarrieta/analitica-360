// Ventas: quién la cargó y de qué ubicación salió (como el legacy desde el 25/9), en el
// listado y en la ficha. AppModule completo y guards reales.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts ventas-carga
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

describe.skipIf(!URL_E2E)('Ventas: quién cargó y ubicación (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const sufijo = randomUUID().slice(0, 8);
  const DUENO = { Authorization: `Bearer user_vc_${sufijo}|org_vc_${sufijo}` };
  const empresa = randomUUID();
  const usuario = randomUUID();
  const producto = randomUUID();
  const conUbicacion = randomUUID();
  const sinUbicacion = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `Ventas carga ${sufijo}`, `org_vc_${sufijo}`]);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, ' Lucía ', $3, $4, 'dueno')`, [usuario, empresa, `vc_${sufijo}@e2e.test`, `user_vc_${sufijo}`]);
    await suscripcionActiva(db, empresa);
    await db.query(`INSERT INTO productos (id, empresa_id, nombre) VALUES ($1, $2, 'Mate')`, [producto, empresa]);
    for (const [venta, numero, fecha] of [
      [conUbicacion, 'V-1', '2026-10-01T15:00:00Z'],
      [sinUbicacion, 'V-2', '2026-10-02T15:00:00Z'],
    ]) {
      await db.query(`INSERT INTO ventas (id, empresa_id, usuario_id, forma_pago, numero_venta, fecha) VALUES ($1, $2, $3, 'efectivo', $4, $5)`, [venta, empresa, usuario, numero, fecha]);
    }
    // Una venta con dos salidas de stock desde el mismo local; la otra sin ubicación.
    for (const [venta, ubicacion] of [
      [conUbicacion, 'Local Centro'],
      [conUbicacion, 'Local Centro'],
      [sinUbicacion, null],
    ]) {
      await db.query(
        `INSERT INTO movimientos_inventario (id, empresa_id, producto_id, usuario_id, tipo, cantidad, signo, ubicacion_origen, referencia_id)
         VALUES ($1, $2, $3, $4, 'venta', 1, -1, $5, $6)`,
        [randomUUID(), empresa, producto, usuario, ubicacion, venta],
      );
    }
    const { AppModule } = await import('../src/app.module.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('el listado trae quién cargó cada venta y su ubicación', async () => {
    const r = await request(app.getHttpServer()).get('/ventas').set(DUENO).expect(200);
    const datos = r.body.items.map((v: { numeroVenta: string; cargadoPor: string | null; ubicacion: string | null }) => [v.numeroVenta, v.cargadoPor, v.ubicacion]);
    expect(datos).toEqual([
      ['V-2', 'Lucía', null],
      ['V-1', 'Lucía', 'Local Centro'],
    ]);
  });

  it('la ficha también', async () => {
    const r = await request(app.getHttpServer()).get(`/ventas/${conUbicacion}`).set(DUENO).expect(200);
    expect({ cargadoPor: r.body.cargadoPor, ubicacion: r.body.ubicacion }).toEqual({ cargadoPor: 'Lucía', ubicacion: 'Local Centro' });
  });
});
