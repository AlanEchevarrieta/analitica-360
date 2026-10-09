import { describe, expect, it } from 'vitest';
import { estadoPedidoDesde, itemsZipnova, leerCodigo, leerCotizacion, partirDireccion } from './envios.util.js';

describe('itemsZipnova', () => {
  it('un ítem por unidad; sin datos, peso por defecto y caja de 10 cm', () => {
    const items = itemsZipnova(
      [
        { cantidad: 2, pesoGr: 350.4, altoCm: 20, anchoCm: 8, largoCm: 8, nombre: 'Mate imperial' },
        { cantidad: 1, pesoGr: null, altoCm: null, anchoCm: null, largoCm: null },
      ],
      800,
    );
    expect(items).toEqual([
      { weight: 350, height: 20, width: 8, length: 8, description: 'Mate imperial' },
      { weight: 350, height: 20, width: 8, length: 8, description: 'Mate imperial' },
      { weight: 800, height: 10, width: 10, length: 10 },
    ]);
  });

  it('muchas unidades se agrupan sin perder peso', () => {
    const items = itemsZipnova([{ cantidad: 250, pesoGr: 100, altoCm: 5, anchoCm: 5, largoCm: 5 }], 1000);
    expect(items.length).toBeLessThanOrEqual(100);
    expect(items.reduce((a, i) => a + i.weight, 0)).toBeGreaterThanOrEqual(25_000 - 100);
  });
});

describe('partirDireccion', () => {
  it.each([
    ['San Martín 1234', { street: 'San Martín', street_number: '1234' }],
    ['Av. Colón 55, piso 3 dto B', { street: 'Av. Colón', street_number: '55', street_extras: 'piso 3 dto B' }],
    ['Calle 12 Nº 345', { street: 'Calle 12', street_number: '345' }],
    ['Barrio Los Álamos manzana', { street: 'Barrio Los Álamos manzana', street_number: 'S/N' }],
  ])('%s', (d, esperado) => expect(partirDireccion(d)).toEqual(esperado));
});

describe('leerCotizacion', () => {
  const respuesta = {
    results: {
      a: { selectable: true, logistic_type: 'carrier_pickup', carrier: { id: 3, name: 'Andreani' }, service_type: { code: 'standard_delivery', name: 'Estándar' }, amounts: { price: 5000, price_incl_tax: 6050 }, delivery_time: { estimated_delivery: '2026-10-15T23:59:59+00:00' } },
      b: { selectable: true, logistic_type: 'carrier_dropoff', carrier: { id: 1, name: 'Correo Argentino' }, service_type: { code: 'standard_delivery', name: 'Clásico' }, amounts: { price_incl_tax: 4200.4 } },
      c: { selectable: false, impediments: ['peso'], logistic_type: 'carrier_pickup', carrier: { id: 5, name: 'OCA' }, service_type: { code: 'standard_delivery' }, amounts: { price_incl_tax: 100 } },
      d: { selectable: true, logistic_type: 'carrier_dropoff', carrier: { id: 1, name: 'Correo Argentino' }, service_type: { code: 'pickup_point', name: 'Retiro en sucursal' }, amounts: { price_incl_tax: 3000 } },
    },
  };

  it('solo las elegibles a domicilio, de la más barata a la más cara, con IVA', () => {
    expect(leerCotizacion(respuesta)).toEqual([
      { codigo: '1:standard_delivery:carrier_dropoff', transportista: 'Correo Argentino', servicio: 'Clásico', precio: 4200, llegada: null },
      { codigo: '3:standard_delivery:carrier_pickup', transportista: 'Andreani', servicio: 'Estándar', precio: 6050, llegada: '2026-10-15' },
    ]);
  });

  it('respuesta vacía o rara: sin opciones', () => {
    expect(leerCotizacion({})).toEqual([]);
    expect(leerCotizacion(null)).toEqual([]);
  });

  it('el código se lee de vuelta y rechaza basura', () => {
    expect(leerCodigo('3:standard_delivery:carrier_pickup')).toEqual({ carrierId: 3, servicio: 'standard_delivery', logistica: 'carrier_pickup' });
    expect(leerCodigo('3:<script>:x')).toBeNull();
  });
});

describe('estadoPedidoDesde', () => {
  it('traduce los estados de Zipnova', () => {
    expect(estadoPedidoDesde('in_transit')).toBe('con_transportista');
    expect(estadoPedidoDesde('delivered')).toBe('entregado');
    expect(estadoPedidoDesde('documentation_ready')).toBeNull();
    expect(estadoPedidoDesde(undefined)).toBeNull();
  });
});
