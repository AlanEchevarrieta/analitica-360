import test from 'node:test';
import assert from 'node:assert/strict';
import { Analitica360Client } from '../src/client.js';
import { Analitica360Error } from '../src/errors.js';

test('Analitica360Client: inicialización', () => {
  assert.throws(() => new Analitica360Client({ empresaId: '' }), /empresaId/);

  const client = new Analitica360Client({
    empresaId: '123e4567-e89b-12d3-a456-426614174000',
    baseUrl: 'https://api.test.analitica360.app/',
  });

  assert.equal(client.empresaId, '123e4567-e89b-12d3-a456-426614174000');
  assert.equal(client.baseUrl, 'https://api.test.analitica360.app');
});

test('Analitica360Client: turnos.opciones', async () => {
  let capturedUrl = '';
  const mockFetch: typeof fetch = async (input, init) => {
    capturedUrl = input.toString();
    return new Response(
      JSON.stringify({
        activa: true,
        diasMaximo: 30,
        hoy: '2026-10-27',
        mensaje: 'Bienvenido',
        servicios: [{ id: 's1', nombre: 'Corte', duracionMin: 30, precio: 5000, modoPrecio: 'fijo' }],
        profesionales: [{ id: 'p1', nombre: 'Carlos', color: '#10b981' }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const client = new Analitica360Client({
    empresaId: 'emp-123',
    baseUrl: 'http://localhost:3001',
    fetch: mockFetch,
  });

  const res = await client.turnos.opciones();
  assert.equal(capturedUrl, 'http://localhost:3001/tienda/emp-123/turnos');
  assert.equal(res.activa, true);
  if (res.activa) {
    assert.equal(res.servicios.length, 1);
    assert.equal(res.servicios[0].nombre, 'Corte');
  }
});

test('Analitica360Client: turnos.libres query params', async () => {
  let capturedUrl = '';
  const mockFetch: typeof fetch = async (input) => {
    capturedUrl = input.toString();
    return new Response(
      JSON.stringify({
        fecha: '2026-10-30',
        duracionMin: 45,
        libres: [{ hora: '10:00', profesionales: ['p1'] }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const client = new Analitica360Client({
    empresaId: 'emp-123',
    baseUrl: 'http://localhost:3001',
    fetch: mockFetch,
  });

  const res = await client.turnos.libres({
    fecha: '2026-10-30',
    servicioId: 'srv-456',
    recursoId: 'rec-789',
  });

  assert.equal(capturedUrl, 'http://localhost:3001/tienda/emp-123/turnos/libres?fecha=2026-10-30&servicioId=srv-456&recursoId=rec-789');
  assert.equal(res.libres.length, 1);
  assert.equal(res.libres[0].hora, '10:00');
});

test('Analitica360Client: turnos.reservar envío de datos', async () => {
  let capturedBody = '';
  let capturedMethod = '';
  const mockFetch: typeof fetch = async (input, init) => {
    capturedMethod = init?.method || '';
    capturedBody = (init?.body as string) || '';
    return new Response(
      JSON.stringify({
        id: 'turno-999',
        servicio: 'Masaje',
        profesional: 'Lucía',
        inicio: '2026-10-30T15:00:00Z',
        fin: '2026-10-30T16:00:00Z',
        cuando: 'Viernes 30 a las 15:00',
        mensaje: null,
        cancelar: 'token_firmado_123',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const client = new Analitica360Client({
    empresaId: 'emp-123',
    baseUrl: 'http://localhost:3001',
    fetch: mockFetch,
  });

  const res = await client.turnos.reservar({
    servicioId: 'srv-1',
    fecha: '2026-10-30',
    hora: '15:00',
    nombre: 'Valeria',
    telefono: '2615550000',
  });

  assert.equal(capturedMethod, 'POST');
  const parsed = JSON.parse(capturedBody);
  assert.equal(parsed.nombre, 'Valeria');
  assert.equal(parsed.servicioId, 'srv-1');
  assert.equal(res.id, 'turno-999');
  assert.equal(res.cancelar, 'token_firmado_123');
});

test('Analitica360Client: manejo de errores y validaciones Zod', async () => {
  const mockFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        message: 'Validation failed',
        issues: [{ path: ['telefono'], message: 'Poné un teléfono para avisarte' }],
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const client = new Analitica360Client({
    empresaId: 'emp-123',
    baseUrl: 'http://localhost:3001',
    fetch: mockFetch,
  });

  await assert.rejects(
    async () => {
      await client.turnos.reservar({
        servicioId: 'srv-1',
        fecha: '2026-10-30',
        hora: '15:00',
        nombre: 'Valeria',
        telefono: '',
      });
    },
    (err: unknown) => {
      assert(err instanceof Analitica360Error);
      assert.equal(err.status, 400);
      assert.equal(err.message, 'Poné un teléfono para avisarte');
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    },
  );
});
