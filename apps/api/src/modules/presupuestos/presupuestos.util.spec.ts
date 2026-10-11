import { describe, expect, it } from 'vitest';
import { estadoVisible } from './presupuestos.service.js';
import { convertir, montosEnMoneda } from './presupuestos.util.js';

describe('presupuestos', () => {
  it('un pendiente con la validez vencida se ve como vencido', () => {
    expect(estadoVisible('pendiente', '2026-10-10', '2026-10-11')).toBe('vencido');
    expect(estadoVisible('pendiente', '2026-10-11', '2026-10-11')).toBe('pendiente');
    expect(estadoVisible('aceptado', '2026-01-01', '2026-10-11')).toBe('aceptado');
  });

  it('convierte con los decimales de cada moneda', () => {
    expect(convertir(46_050, 1535, 'USD')).toBe(30);
    expect(convertir(10_000, 304.3132, 'BRL')).toBe(32.86);
    expect(convertir(10_000, 1.5509, 'CLP')).toBe(6448);
  });

  it('en otra moneda el total sale de los precios convertidos', () => {
    const m = montosEnMoneda([{ cantidad: 3, precioUnitario: 10_000 }, { cantidad: 1, precioUnitario: 6_800 }], 3_000, 'USD', 1535);
    expect(m).toEqual({ precios: [6.51, 4.43], subtotal: 23.96, descuento: 1.95, total: 22.01 });
  });

  it('en pesos no cambia nada', () => {
    expect(montosEnMoneda([{ cantidad: 2, precioUnitario: 1000 }], 500, 'ARS', null)).toEqual({ precios: [1000], subtotal: 2000, descuento: 500, total: 1500 });
  });
});
