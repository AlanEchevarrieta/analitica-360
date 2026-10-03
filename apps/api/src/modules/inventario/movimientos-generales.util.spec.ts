import { describe, expect, it } from 'vitest';
import { GRUPOS_MOVIMIENTO, NOMBRE_TIPO, nombreTipo, rangoDias, sentido } from './movimientos-generales.util.js';

describe('movimientos generales', () => {
  it('los traslados no entran ni salen; el resto según el signo', () => {
    expect(sentido('transferencia', -1)).toBe('traslado');
    expect(sentido('compra', 1)).toBe('entra');
    expect(sentido('venta', -1)).toBe('sale');
  });

  it('nombres en castellano y algo legible para tipos nuevos', () => {
    expect(nombreTipo('devolucion_cliente')).toBe('Devolución de cliente');
    expect(nombreTipo('algo_nuevo')).toBe('algo nuevo');
  });

  it('cada tipo con nombre pertenece a un solo grupo de filtro', () => {
    const todos = Object.values(GRUPOS_MOVIMIENTO).flat();
    expect(new Set(todos).size).toBe(todos.length);
    expect([...todos].sort()).toEqual(Object.keys(NOMBRE_TIPO).sort());
  });

  it('el rango toma días enteros de Argentina (UTC−3)', () => {
    const { inicio, fin } = rangoDias('2026-10-01', '2026-10-03');
    expect(inicio.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-10-04T03:00:00.000Z');
  });
});
