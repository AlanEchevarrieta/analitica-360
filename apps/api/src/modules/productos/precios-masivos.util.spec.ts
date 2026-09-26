import { margenPct, precioNuevo, redondearArriba } from './precios-masivos.util.js';

describe('aumento masivo de precios', () => {
  it('redondea hacia arriba al múltiplo', () => {
    expect(redondearArriba(12_340, 100)).toBe(12_400);
    expect(redondearArriba(12_400, 100)).toBe(12_400);
    expect(redondearArriba(12_341, 500)).toBe(12_500);
    expect(redondearArriba(1234.567, 0)).toBe(1234.57);
  });

  it('por porcentaje', () => {
    expect(precioNuevo(15_000, 8_000, { modo: 'porcentaje', valor: 8, redondeo: 0 })).toBe(16_200);
    expect(precioNuevo(15_000, 8_000, { modo: 'porcentaje', valor: 8, redondeo: 500 })).toBe(16_500);
    expect(precioNuevo(10_000, null, { modo: 'porcentaje', valor: -10, redondeo: 0 })).toBe(9_000);
    expect(precioNuevo(null, 8_000, { modo: 'porcentaje', valor: 8, redondeo: 0 })).toBeNull();
  });

  it('llevar a un margen sobre el precio', () => {
    // costo 8.000 con 50% de margen -> precio 16.000 (la ganancia es la mitad del precio)
    expect(precioNuevo(15_000, 8_000, { modo: 'margen', valor: 50, redondeo: 0 })).toBe(16_000);
    expect(precioNuevo(15_000, 7_000, { modo: 'margen', valor: 40, redondeo: 100 })).toBe(11_700);
    expect(precioNuevo(15_000, null, { modo: 'margen', valor: 50, redondeo: 0 })).toBeNull();
    expect(precioNuevo(15_000, 8_000, { modo: 'margen', valor: 100, redondeo: 0 })).toBeNull();
  });

  it('margen resultante', () => {
    expect(margenPct(16_000, 8_000)).toBe(50);
    expect(margenPct(16_000, null)).toBeNull();
  });
});
