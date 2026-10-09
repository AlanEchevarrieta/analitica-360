// Envíos con Zipnova de punta a punta, con Zipnova simulado: el dueño conecta la cuenta (credenciales
// cifradas), la tienda cotiza por código postal, el pedido cobra el envío recotizado en el servidor
// (el precio del navegador no vale), envío gratis desde un monto, crear el envío una sola vez aunque
// lleguen dos clics, etiqueta en PDF y el aviso de Zipnova que marca el pedido como entregado.
//
// Misma base descartable que alianzas.e2e-spec.ts:
//   E2E_DATABASE_URL=postgresql://postgres:e2e@localhost:5499/postgres pnpm exec vitest run --config vitest.config.e2e.ts envios
import { randomBytes, randomUUID } from 'node:crypto';
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

/** Zipnova de mentira: dos transportistas, envíos numerados y estados que se cambian a mano. */
class ZipnovaFalso {
  envios = new Map<string, { status: string; datos: Record<string, unknown> }>();
  ultimo = 5000;
  async verificar(cred: { token: string; secreto: string }) {
    if (cred.secreto !== 'secreto-bueno') throw Object.assign(new Error('x'), { getStatus: () => 400, getResponse: () => ({ message: 'Zipnova rechazó las credenciales' }) });
    return { nombre: 'Mates del Sur' };
  }
  async cotizar(_cred: unknown, d: { items: { weight: number }[] }) {
    const peso = d.items.reduce((a, i) => a + i.weight, 0);
    return {
      results: {
        a: { selectable: true, logistic_type: 'carrier_pickup', carrier: { id: 3, name: 'Andreani' }, service_type: { code: 'standard_delivery', name: 'Estándar' }, amounts: { price_incl_tax: 6000 + peso } },
        b: { selectable: true, logistic_type: 'carrier_dropoff', carrier: { id: 1, name: 'Correo Argentino' }, service_type: { code: 'standard_delivery', name: 'Clásico' }, amounts: { price_incl_tax: 4000 + peso } },
      },
    };
  }
  async crear(_cred: unknown, d: Record<string, unknown>) {
    await new Promise((r) => setTimeout(r, 40)); // como la red: deja lugar a que se crucen dos clics
    const id = ++this.ultimo;
    this.envios.set(String(id), { status: 'documentation_ready', datos: d });
    return { id, status: 'documentation_ready', carrier: d.carrierId === 3 ? 'Andreani' : 'Correo Argentino', seguimiento: `ZN${id}` };
  }
  async envio(_cred: unknown, id: string) {
    const e = this.envios.get(id)!;
    return { id: Number(id), status: e.status, carrier: 'Correo Argentino', seguimiento: e.status === 'in_transit' ? 'CA123456789AR' : `ZN${id}` };
  }
  async etiqueta() {
    return Buffer.from('%PDF-1.4 etiqueta');
  }
}

describe.skipIf(!URL_E2E)('Envíos con Zipnova (e2e)', () => {
  let app: INestApplication;
  let db: pg.Client;
  const zipnova = new ZipnovaFalso();
  const sufijo = randomUUID().slice(0, 8);
  const empresa = randomUUID();
  const mate = randomUUID();
  const DUENO = { Authorization: `Bearer user_end_${sufijo}|org_en_${sufijo}` };
  const EMPLEADO = { Authorization: `Bearer user_enp_${sufijo}|org_en_${sufijo}` };
  const cliente = { clienteNombre: 'Ana', clienteEmail: 'ana@example.com', clienteTelefono: '2615555555', direccionEnvio: 'San Martín 1234, piso 2', codigoPostal: '5500', localidad: 'Mendoza', provincia: 'Mendoza' };
  const s = () => app.getHttpServer();
  let ip = 1;
  const publico = () => ({ 'x-forwarded-for': `10.1.0.${ip++}` });
  const config = { cuentaId: 777, token: 'tok', secreto: 'secreto-bueno', gratisDesde: 100_000, pesoDefectoGr: 500 };
  let pedido = '';
  let avisos = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_E2E;
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.INTERNAL_WEBHOOK_SECRET = 'e2e';
    process.env.CLAVE_CIFRADO = randomBytes(32).toString('base64');
    process.env.API_URL_PUBLICA = 'https://api.ejemplo.test';
    db = new pg.Client({ connectionString: URL_E2E });
    await db.connect();
    await db.query(`INSERT INTO empresas (id, nombre, clerk_org_id) VALUES ($1, $2, $3)`, [empresa, `Envios ${sufijo}`, `org_en_${sufijo}`]);
    await suscripcionActiva(db, empresa);
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Dueña', $3, $4, 'dueno')`, [randomUUID(), empresa, `end_${sufijo}@e2e.test`, `user_end_${sufijo}`]);
    // Empleado con acceso a pedidos y permiso para preparar y despachar: crea envíos, pero no conecta la cuenta.
    const empleado = randomUUID();
    await db.query(`INSERT INTO usuarios (id, empresa_id, nombre, email, clerk_user_id, rol) VALUES ($1, $2, 'Empleado', $3, $4, 'operador')`, [empleado, empresa, `enp_${sufijo}@e2e.test`, `user_enp_${sufijo}`]);
    await db.query(`INSERT INTO colaborador_permisos (id, empresa_id, usuario_id, modulos, acciones) VALUES ($1, $2, $3, '{"pedidos": true}', '{"hacer_picking": true}')`, [randomUUID(), empresa, empleado]);
    await db.query(`INSERT INTO tiendas_config (id, empresa_id, subdominio, nombre, activa) VALUES ($1, $2, $3, 'Tienda', true)`, [randomUUID(), empresa, `env-${sufijo}`]);
    await db.query(`INSERT INTO productos (id, empresa_id, nombre, precio_venta, en_tienda, peso_gr, alto_cm, ancho_cm, largo_cm) VALUES ($1, $2, 'Mate Imperial', 20000, true, 400, 15, 10, 10)`, [mate, empresa]);
    const { AppModule } = await import('../src/app.module.js');
    const { ZipnovaCliente } = await import('../src/modules/envios/zipnova.cliente.js');
    app = (await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ZipnovaCliente).useValue(zipnova).compile()).createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const cotizar = (cantidad: number) => request(s()).post(`/tienda/${empresa}/envios/cotizar`).set(publico()).send({ codigoPostal: '5500', localidad: 'Mendoza', provincia: 'Mendoza', items: [{ productoId: mate, cantidad }] });

  it('sin conectar, la tienda no ofrece envíos (queda a coordinar)', async () => {
    const r = await cotizar(1).expect(201);
    expect(r.body.opciones).toEqual([]);
  });

  it('solo el dueño conecta; las credenciales quedan cifradas y no vuelven nunca', async () => {
    const r403 = await request(s()).put('/envios').set(EMPLEADO).send(config).expect(403);
    expect(r403.body.message).toContain('Solo el dueño');
    await request(s()).put('/envios').set(DUENO).send({ cuentaId: 777 }).expect(400);
    const r = await request(s()).put('/envios').set(DUENO).send(config).expect(200);
    expect(r.body.config).toMatchObject({ cuentaId: 777, enTienda: true, gratisDesde: 100_000 });
    expect(JSON.stringify(r.body)).not.toContain('secreto-bueno');
    avisos = r.body.config.urlAvisos;
    expect(avisos).toMatch(/^https:\/\/api\.ejemplo\.test\/webhooks\/zipnova\/[\w-]{20,}$/);
    const { rows } = await db.query(`SELECT credenciales FROM envios_config WHERE empresa_id = $1`, [empresa]);
    expect(rows[0].credenciales).not.toContain('secreto');
    // Guardar otra vez sin credenciales mantiene las anteriores.
    await request(s()).put('/envios').set(DUENO).send({ ...config, token: null, secreto: null, pesoDefectoGr: 600 }).expect(200);
  });

  it('la tienda cotiza por código postal con el peso de los productos, de la más barata a la más cara', async () => {
    const r = await cotizar(2).expect(201);
    expect(r.body.opciones).toEqual([
      expect.objectContaining({ transportista: 'Correo Argentino', precio: 4800, codigo: '1:standard_delivery:carrier_dropoff' }),
      expect.objectContaining({ transportista: 'Andreani', precio: 6800 }),
    ]);
  });

  it('desde $100.000, la más barata sale gratis', async () => {
    const r = await cotizar(5).expect(201);
    expect(r.body.opciones.map((o: { precio: number }) => o.precio)).toEqual([0, 8000]);
  });

  it('el pedido cobra el envío que cotiza el servidor; un código inventado se rechaza', async () => {
    await request(s()).post(`/tienda/${empresa}/pedidos`).set(publico()).send({ ...cliente, items: [{ productoId: mate, cantidad: 2 }], envio: '9:express:carrier_pickup' }).expect(400);
    const r = await request(s()).post(`/tienda/${empresa}/pedidos`).set(publico()).send({ ...cliente, items: [{ productoId: mate, cantidad: 2 }], envio: '3:standard_delivery:carrier_pickup' }).expect(201);
    expect(r.body).toMatchObject({ subtotal: 40_000, costoEnvio: 6800, total: 46_800 });
    pedido = r.body.id;
    const f = await request(s()).get(`/pedidos/${pedido}`).set(DUENO).expect(200);
    expect(f.body).toMatchObject({ total: 46_800, costoEnvio: 6800, metodoEnvio: 'Andreani · Estándar', envio: null });
  });

  it('crear el envío una sola vez aunque lleguen dos clics, con la opción que eligió el cliente', async () => {
    const [a, b] = await Promise.all([request(s()).post(`/pedidos/${pedido}/envio`).set(EMPLEADO), request(s()).post(`/pedidos/${pedido}/envio`).set(EMPLEADO)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(zipnova.envios.size).toBe(1);
    const [creado] = [...zipnova.envios.values()];
    expect(creado.datos).toMatchObject({ carrierId: 3, servicio: 'standard_delivery', destino: expect.objectContaining({ street: 'San Martín', street_number: '1234', street_extras: 'piso 2', zipcode: '5500' }) });
    const f = await request(s()).get(`/pedidos/${pedido}`).set(DUENO).expect(200);
    expect(f.body).toMatchObject({ transportista: 'Andreani', numeroSeguimiento: expect.stringMatching(/^ZN/), envio: { estado: 'documentation_ready' } });
  });

  it('la etiqueta sale en PDF', async () => {
    const r = await request(s())
      .get(`/pedidos/${pedido}/envio/etiqueta`)
      .set(EMPLEADO)
      .buffer(true)
      .parse((res, cb) => {
        const partes: Buffer[] = [];
        res.on('data', (c: Buffer) => partes.push(c));
        res.on('end', () => cb(null, Buffer.concat(partes)));
      })
      .expect(200);
    expect(r.headers['content-type']).toContain('application/pdf');
    expect((r.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('los avisos de Zipnova mueven el pedido despachado: en camino y entregado', async () => {
    const clave = avisos.split('/').pop()!;
    const envioId = [...zipnova.envios.keys()][0];
    await request(s()).post('/webhooks/zipnova/clave-que-no-existe-0000000').send({ id: envioId }).expect(404);

    // Antes del despacho (que registra la venta) solo se guarda el estado.
    zipnova.envios.get(envioId)!.status = 'in_transit';
    await request(s()).post(`/webhooks/zipnova/${clave}`).send({ id: Number(envioId), status: 'delivered' }).expect(200);
    let { rows } = await db.query(`SELECT estado, envio_estado, numero_seguimiento FROM pedidos WHERE id = $1`, [pedido]);
    expect(rows[0]).toMatchObject({ estado: 'nuevo', envio_estado: 'in_transit', numero_seguimiento: 'CA123456789AR' });

    await db.query(`UPDATE pedidos SET estado = 'despachado' WHERE id = $1`, [pedido]);
    await request(s()).post(`/webhooks/zipnova/${clave}`).send({ shipment_id: envioId }).expect(200);
    ({ rows } = await db.query(`SELECT estado FROM pedidos WHERE id = $1`, [pedido]));
    expect(rows[0].estado).toBe('con_transportista');

    zipnova.envios.get(envioId)!.status = 'delivered';
    const r = await request(s()).post(`/pedidos/${pedido}/envio/actualizar`).set(DUENO).expect(200);
    expect(r.body).toMatchObject({ estado: 'delivered', estadoNombre: 'Entregado' });
    ({ rows } = await db.query(`SELECT estado FROM pedidos WHERE id = $1`, [pedido]));
    expect(rows[0].estado).toBe('entregado');
  });

  it('el dueño desconecta y la tienda vuelve a "a coordinar"', async () => {
    await request(s()).delete('/envios').set(EMPLEADO).expect(403);
    await request(s()).delete('/envios').set(DUENO).expect(204);
    expect((await cotizar(1).expect(201)).body.opciones).toEqual([]);
  });
});
