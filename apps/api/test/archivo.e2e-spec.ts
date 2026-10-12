// Archivo de documentos de punta a punta: plan Pro, quién ve y quién sube, tipos
// aceptados, carpeta privada (no se publica en /archivos), adjuntar a un proveedor,
// vencimientos con avisos a los 30 y 7 días (Resend simulado) y aislamiento.
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts archivo
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
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
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

describe.skipIf(!URL_E2E)('Archivo de documentos (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const carpetas = { publica: mkdtempSync(join(tmpdir(), 'a360-pub-')), privada: mkdtempSync(join(tmpdir(), 'a360-priv-')) };
  const sufijo = randomUUID().slice(0, 8);
  const pro = randomUUID();
  const basico = randomUUID();
  const proveedor = randomUUID();
  const emails: { to: string[]; subject: string; text: string }[] = [];
  const DUENO = { Authorization: `Bearer user_ard_${sufijo}|org_ar_${sufijo}` };
  const CONTADOR = { Authorization: `Bearer user_arc_${sufijo}|org_ar_${sufijo}` };
  const VENDEDOR = { Authorization: `Bearer user_arv_${sufijo}|org_ar_${sufijo}` };
  const BASICO = { Authorization: `Bearer user_arb_${sufijo}|org_arb_${sufijo}` };
  const OTRA = { Authorization: `Bearer user_aro_${sufijo}|org_aro_${sufijo}` };
  let doc = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    process.env.RESEND_API_KEY = 're_e2e';
    process.env.ARCHIVOS_DIR = carpetas.publica;
    process.env.ARCHIVOS_PRIVADOS_DIR = carpetas.privada;
    const original = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).startsWith('https://api.resend.com/')) {
        emails.push(JSON.parse(String(init?.body)));
        return new Response('{}', { status: 200 });
      }
      return original(url, init);
    });
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    const usuario = (emp: string, user: string, rol: string) => db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'U', $3, $4, $5)`, [randomUUID(), emp, `${user}@e2e.test`, user, rol]);
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [pro, `Archivo ${sufijo}`, `org_ar_${sufijo}`]);
    await usuario(pro, `user_ard_${sufijo}`, 'dueno');
    await usuario(pro, `user_arc_${sufijo}`, 'contador');
    await usuario(pro, `user_arv_${sufijo}`, 'operador');
    await suscripcionActiva(db, pro, 'pro');
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [basico, `ArchivoB ${sufijo}`, `org_arb_${sufijo}`]);
    await usuario(basico, `user_arb_${sufijo}`, 'dueno');
    await suscripcionActiva(db, basico, 'basico');
    const otra = randomUUID();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [otra, `ArchivoO ${sufijo}`, `org_aro_${sufijo}`]);
    await usuario(otra, `user_aro_${sufijo}`, 'dueno');
    await suscripcionActiva(db, otra, 'pro');
    await db.query(`INSERT INTO proveedores (id, empresa_id, nombre) VALUES ($1, $2, 'Calabazas del Norte')`, [proveedor, pro]);

    const { AppModule } = await import('../src/app.module.js');
    const { AlmacenArchivosService } = await import('../src/common/archivos/almacen-archivos.service.js');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const nest = modulo.createNestApplication<NestExpressApplication>();
    // Igual que main.ts: la carpeta pública se sirve en /archivos (la privada, no).
    nest.useStaticAssets(AlmacenArchivosService.carpetaLocal(carpetas.publica), { prefix: '/archivos/' });
    app = nest;
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
    vi.restoreAllMocks();
    for (const c of Object.values(carpetas)) rmSync(c, { recursive: true, force: true });
  });

  const api = () => request(app.getHttpServer());
  const subir = (headers: Record<string, string>, archivo: Buffer, nombre: string, campos: Record<string, string> = {}) => {
    let r = api().post('/archivo').set(headers).attach('archivo', archivo, nombre);
    for (const [k, v] of Object.entries(campos)) r = r.field(k, v);
    return r;
  };

  it('en el Básico no hay archivo', async () => {
    const r = await api().get('/archivo').set(BASICO).expect(403);
    expect(r.body.code).toBe('plan_insuficiente');
  });

  it('el dueño sube un contrato pegado al proveedor, con vencimiento', async () => {
    const r = await subir(DUENO, PDF, 'Contrato de alquiler.pdf', { categoria: 'contrato', entidadTipo: 'proveedor', entidadId: proveedor, vence: dias(20), notas: 'Renovar con aumento' }).expect(201);
    doc = r.body.id;
    expect(r.body).toMatchObject({ titulo: 'Contrato de alquiler', categoria: 'contrato', entidadTipo: 'proveedor', entidadId: proveedor, mime: 'application/pdf', vence: dias(20), estado: 'por_vencer', diasParaVencer: 20 });
    const lista = await api().get(`/archivo?entidadTipo=proveedor&entidadId=${proveedor}`).set(DUENO).expect(200);
    expect(lista.body.map((d: { id: string }) => d.id)).toEqual([doc]);
    expect((await api().get('/archivo/uso').set(DUENO).expect(200)).body).toMatchObject({ usado: PDF.length, cantidad: 1, limite: 10 * 1024 ** 3 });
  });

  it('rechaza lo que no es PDF, foto, Word o Excel (aunque cambie la extensión)', async () => {
    const r = await subir(DUENO, Buffer.from('MZ\x90\x00 programa'), 'factura.pdf').expect(400);
    expect(r.body.message).toContain('no se acepta');
    await subir(DUENO, PDF, 'x.pdf', { entidadTipo: 'proveedor', entidadId: randomUUID() }).expect(400);
  });

  it('el contador ve y baja; el vendedor no; solo el dueño sube y borra', async () => {
    const bajado = await api().get(`/archivo/${doc}/descargar`).set(CONTADOR).buffer(true).parse((res, cb) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    }).expect(200);
    expect(Buffer.compare(bajado.body as Buffer, PDF)).toBe(0);
    expect(bajado.headers['content-disposition']).toContain('inline');
    await api().get('/archivo').set(VENDEDOR).expect(403);
    await subir(CONTADOR, PDF, 'x.pdf').expect(403);
    await api().delete(`/archivo/${doc}`).set(CONTADOR).expect(403);
  });

  it('el archivo no queda publicado en /archivos', async () => {
    const { rows } = await db.query(`SELECT clave FROM archivo_documentos WHERE id = $1`, [doc]);
    await api().get(`/archivos/${rows[0].clave}`).expect(404);
  });

  it('otra empresa no lo ve ni lo baja', async () => {
    await api().get(`/archivo/${doc}/descargar`).set(OTRA).expect(404);
    await api().delete(`/archivo/${doc}`).set(OTRA).expect(404);
    expect((await api().get('/archivo').set(OTRA).expect(200)).body).toEqual([]);
  });

  it('avisa a los 30 días, después a los 7, y al renovar vuelve a avisar', async () => {
    const { ArchivoService } = await import('../src/modules/archivo/archivo.service.js');
    const servicio = app.get(ArchivoService);
    await servicio.avisarVencimientos();
    const aviso = emails.find((e) => e.to.includes(`user_ard_${sufijo}@e2e.test`));
    expect(aviso?.subject).toContain('Un documento vence pronto');
    expect(aviso?.text).toContain('Contrato: Contrato de alquiler');
    expect(aviso?.text).toContain('en 20 días');
    expect(aviso?.to).not.toContain(`user_arv_${sufijo}@e2e.test`);
    const antes = emails.length;
    await servicio.avisarVencimientos();
    expect(emails.length).toBe(antes);
    await api().patch(`/archivo/${doc}`).set(DUENO).send({ vence: dias(5) }).expect(200);
    await servicio.avisarVencimientos();
    expect(emails.at(-1)?.text).toContain('en 5 días');
    const porVencer = await api().get('/archivo/por-vencer').set(DUENO).expect(200);
    expect(porVencer.body[0]).toMatchObject({ id: doc, diasParaVencer: 5 });
  });

  it('al borrar se va el archivo y libera el espacio', async () => {
    await api().delete(`/archivo/${doc}`).set(DUENO).expect(200);
    await api().get(`/archivo/${doc}/descargar`).set(DUENO).expect(404);
    expect((await api().get('/archivo/uso').set(DUENO).expect(200)).body.usado).toBe(0);
  });
});
