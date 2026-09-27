import { costoReceta, expandirKits, margenFabricacion, necesidades } from './produccion.util.js';

describe('producción', () => {
  // Mate imperial: 1 calabaza ($3.000) + 1 virola ($1.500) + 0,3 m de cuero ($5.000 el metro), 20 minutos.
  const mate = [
    { insumoId: 'calabaza', insumoVarianteId: null, cantidad: 1, costoUnitario: 3000 },
    { insumoId: 'virola', insumoVarianteId: null, cantidad: 1, costoUnitario: 1500 },
    { insumoId: 'cuero', insumoVarianteId: null, cantidad: 0.3, costoUnitario: 5000 },
  ];

  it('costo de fabricar: materiales + mano de obra (minutos × valor hora)', () => {
    expect(costoReceta(mate, 20, 6000)).toEqual({ materiales: 6000, manoObra: 2000, total: 8000, sinCosto: 0 });
    expect(costoReceta(mate, 20, null)).toEqual({ materiales: 6000, manoObra: 0, total: 6000, sinCosto: 0 });
    expect(costoReceta([{ insumoId: 'x', insumoVarianteId: null, cantidad: 2, costoUnitario: null }], 0, null).sinCosto).toBe(1);
  });

  it('margen sobre el precio', () => {
    expect(margenFabricacion(16000, 8000)).toBe(50);
    expect(margenFabricacion(null, 8000)).toBeNull();
  });

  it('necesidades de una orden y faltantes', () => {
    const stock = new Map([
      ['calabaza:', 25],
      ['virola:', 10],
      ['cuero:', 5],
    ]);
    const n = necesidades(mate, 20, stock);
    expect(n).toEqual([
      { insumoId: 'calabaza', insumoVarianteId: null, necesita: 20, stock: 25, falta: 0 },
      { insumoId: 'virola', insumoVarianteId: null, necesita: 20, stock: 10, falta: 10 },
      { insumoId: 'cuero', insumoVarianteId: null, necesita: 6, stock: 5, falta: 1 },
    ]);
  });

  it('insumo repetido se suma; stock negativo cuenta como cero', () => {
    const n = necesidades(
      [
        { insumoId: 'hilo', insumoVarianteId: null, cantidad: 0.333 },
        { insumoId: 'hilo', insumoVarianteId: null, cantidad: 0.333 },
      ],
      3,
      new Map([['hilo:', -4]]),
    );
    expect(n).toEqual([{ insumoId: 'hilo', insumoVarianteId: null, necesita: 2, stock: -4, falta: 2 }]);
  });

  it('kit que se arma al vender: la venta descuenta los componentes', () => {
    const kits = [
      {
        productoId: 'set',
        varianteId: null,
        componentes: [
          { insumoId: 'mate', insumoVarianteId: null, cantidad: 1 },
          { insumoId: 'bombilla', insumoVarianteId: 'b-plata', cantidad: 1 },
          { insumoId: 'yerba', insumoVarianteId: null, cantidad: 0.5 },
        ],
      },
    ];
    const r = expandirKits(
      [
        { productoId: 'set', varianteId: null, cantidad: 2 },
        { productoId: 'termo', varianteId: null, cantidad: 1 },
      ],
      kits,
    );
    expect(r[0].esKit).toBe(true);
    expect(r[0].salidas).toEqual([
      { productoId: 'mate', varianteId: null, cantidad: 2 },
      { productoId: 'bombilla', varianteId: 'b-plata', cantidad: 2 },
      { productoId: 'yerba', varianteId: null, cantidad: 1 },
    ]);
    expect(r[1]).toEqual({ original: { productoId: 'termo', varianteId: null, cantidad: 1 }, salidas: [{ productoId: 'termo', varianteId: null, cantidad: 1 }], esKit: false });
  });

  it('kit por producto sirve para todas sus variantes', () => {
    const r = expandirKits([{ productoId: 'set', varianteId: 'set-rojo', cantidad: 1 }], [{ productoId: 'set', varianteId: null, componentes: [{ insumoId: 'mate', insumoVarianteId: null, cantidad: 1 }] }]);
    expect(r[0].esKit).toBe(true);
  });
});
