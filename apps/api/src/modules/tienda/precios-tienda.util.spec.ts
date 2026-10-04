import { describe, expect, it } from 'vitest';
import { evaluarCupon, hoyAR, normalizarCodigo, precioConOferta, totalesPedido, type CuponTienda } from './precios-tienda.util.js';

const HOY = '2026-10-04';
const cupon = (c: Partial<CuponTienda> = {}): CuponTienda => ({ codigo: 'ACACIA10', tipo: 'porcentaje', valor: 10, compraMinima: null, desde: null, hasta: null, usosMax: null, usos: 0, activo: true, ...c });

describe('ofertas por producto', () => {
  it('porcentaje: precio tachado, % y hasta cuándo', () => {
    expect(precioConOferta(15000, { tipo: 'porcentaje', valor: 20, desde: null, hasta: '2026-10-10' }, HOY)).toEqual({ precio: 12000, precioLista: 15000, descuentoPct: 20, ofertaHasta: '2026-10-10' });
  });

  it('precio fijo: el % se calcula solo', () => {
    expect(precioConOferta(49000, { tipo: 'precio', valor: 39900, desde: null, hasta: null }, HOY)).toMatchObject({ precio: 39900, descuentoPct: 19 });
  });

  it('fuera de fechas, o un "precio de oferta" que no baja el precio: sin oferta', () => {
    const sin = { precio: 15000, precioLista: 15000, descuentoPct: 0, ofertaHasta: null };
    expect(precioConOferta(15000, { tipo: 'porcentaje', valor: 20, desde: '2026-10-05', hasta: null }, HOY)).toEqual(sin);
    expect(precioConOferta(15000, { tipo: 'porcentaje', valor: 20, desde: null, hasta: '2026-10-03' }, HOY)).toEqual(sin);
    expect(precioConOferta(15000, { tipo: 'precio', valor: 18000, desde: null, hasta: null }, HOY)).toEqual(sin);
  });

  it('el último día de la oferta todavía vale (fechas inclusive)', () => {
    expect(precioConOferta(1000, { tipo: 'porcentaje', valor: 50, desde: HOY, hasta: HOY }, HOY).precio).toBe(500);
  });
});

describe('cupones', () => {
  it('porcentaje y monto fijo', () => {
    expect(evaluarCupon(cupon(), 45000, HOY)).toEqual({ ok: true, descuento: 4500 });
    expect(evaluarCupon(cupon({ tipo: 'monto', valor: 5000 }), 45000, HOY)).toEqual({ ok: true, descuento: 5000 });
  });

  it('un monto fijo nunca deja el pedido en negativo', () => {
    expect(evaluarCupon(cupon({ tipo: 'monto', valor: 5000 }), 3000, HOY)).toEqual({ ok: true, descuento: 3000 });
  });

  it('cada motivo de rechazo', () => {
    expect(evaluarCupon(null, 1000, HOY)).toMatchObject({ ok: false, motivo: 'no_existe' });
    expect(evaluarCupon(cupon({ activo: false }), 1000, HOY)).toMatchObject({ motivo: 'inactivo' });
    expect(evaluarCupon(cupon({ desde: '2026-10-05' }), 1000, HOY)).toMatchObject({ motivo: 'todavia_no' });
    expect(evaluarCupon(cupon({ hasta: '2026-10-03' }), 1000, HOY)).toMatchObject({ motivo: 'vencido' });
    expect(evaluarCupon(cupon({ usosMax: 5, usos: 5 }), 1000, HOY)).toMatchObject({ motivo: 'agotado' });
    expect(evaluarCupon(cupon({ compraMinima: 30000 }), 29999, HOY)).toEqual({ ok: false, motivo: 'compra_minima', minimo: 30000 });
  });

  it('el código se escribe como sea', () => {
    expect(normalizarCodigo(' acacia 10 ')).toBe('ACACIA10');
  });
});

describe('totales del pedido', () => {
  it('cupón sobre el subtotal y transferencia sobre lo que queda', () => {
    // 50.000 − 10% cupón = 45.000 − 10% transferencia = 40.500
    expect(totalesPedido(50000, 5000, 10, true)).toEqual({ subtotal: 50000, descuentoCupon: 5000, descuentoTransferencia: 4500, total: 40500 });
  });

  it('sin transferencia no hay descuento por transferencia', () => {
    expect(totalesPedido(50000, 0, 10, false)).toEqual({ subtotal: 50000, descuentoCupon: 0, descuentoTransferencia: 0, total: 50000 });
  });

  it('hoy es el día de Argentina', () => {
    expect(hoyAR(new Date('2026-10-05T02:00:00Z'))).toBe('2026-10-04');
  });
});
