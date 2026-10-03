import { describe, expect, it } from 'vitest';
import { normalizarObjetivo, normalizarRuta } from './uso.util.js';

describe('uso de la app', () => {
  it('la ruta se guarda sin ids ni parámetros', () => {
    expect(normalizarRuta('/ventas/3f2c1a9e-1b2c-4d5e-8f90-123456789abc?tab=1')).toBe('/ventas/:id');
    expect(normalizarRuta('/pedidos/42/editar#x')).toBe('/pedidos/:id/editar');
    expect(normalizarRuta('')).toBe('/');
  });

  it('el texto del botón queda en una línea y corto', () => {
    expect(normalizarObjetivo('  Nueva\n   venta ')).toBe('Nueva venta');
    expect(normalizarObjetivo('   ')).toBeNull();
    expect(normalizarObjetivo('x'.repeat(200))).toHaveLength(80);
  });
});
