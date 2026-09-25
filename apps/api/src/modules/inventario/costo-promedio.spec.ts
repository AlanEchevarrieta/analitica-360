import { agruparEntradas, costoPromedioPonderado, costoUnitarioConAdicionales } from './costo-promedio.js';

describe('costoPromedioPonderado', () => {
  it('pondera el stock previo con la entrada', () => {
    // 10 u a $100 + 10 u a $200 => $150
    expect(costoPromedioPonderado(10, 100, 10, 200)).toBe(150);
  });

  it('sin stock previo, el costo es el de la entrada', () => {
    expect(costoPromedioPonderado(0, 100, 5, 300)).toBe(300);
  });

  it('con stock negativo no pondera (no hay mercadería real que promediar)', () => {
    expect(costoPromedioPonderado(-4, 100, 5, 300)).toBe(300);
  });

  it('sin costo previo conocido, toma el de la entrada', () => {
    expect(costoPromedioPonderado(20, null, 5, 300)).toBe(300);
    expect(costoPromedioPonderado(20, 0, 5, 300)).toBe(300);
  });

  it('redondea a centavos', () => {
    expect(costoPromedioPonderado(3, 100, 1, 101)).toBe(100.25);
    expect(costoPromedioPonderado(2, 10, 1, 11)).toBe(10.33);
  });
});

describe('costoUnitarioConAdicionales', () => {
  it('reparte flete/impuestos en proporción al subtotal de cada ítem', () => {
    // subtotales 1000 y 3000; adicionales 400 => 100 y 300
    const costos = costoUnitarioConAdicionales(
      [
        { cantidad: 10, costoUnitario: 100 },
        { cantidad: 10, costoUnitario: 300 },
      ],
      400,
    );
    expect(costos).toEqual([110, 330]);
  });

  it('sin adicionales devuelve el costo de factura', () => {
    expect(costoUnitarioConAdicionales([{ cantidad: 2, costoUnitario: 50 }], 0)).toEqual([50]);
  });

  it('con subtotal 0 no divide por cero', () => {
    expect(costoUnitarioConAdicionales([{ cantidad: 2, costoUnitario: 0 }], 100)).toEqual([0]);
  });
});

describe('agruparEntradas', () => {
  it('junta el mismo producto/variante con costo promedio', () => {
    const agrupadas = agruparEntradas([
      { productoId: 'p1', varianteId: null, cantidad: 2, costoUnitario: 100 },
      { productoId: 'p1', varianteId: null, cantidad: 2, costoUnitario: 200 },
      { productoId: 'p1', varianteId: 'v1', cantidad: 1, costoUnitario: 50 },
    ]);
    expect(agrupadas).toEqual([
      { productoId: 'p1', varianteId: null, cantidad: 4, costoUnitario: 150 },
      { productoId: 'p1', varianteId: 'v1', cantidad: 1, costoUnitario: 50 },
    ]);
  });
});
