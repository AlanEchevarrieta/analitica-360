import { repartirPorUbicacion } from './reparto.util.js';

describe('repartirPorUbicacion', () => {
  it('llena cada variante con el stock de cada ubicación', () => {
    const tramos = repartirPorUbicacion(
      [
        { ubicacion: 'Local', stock: 10 },
        { ubicacion: 'Depósito', stock: 6 },
      ],
      [
        { varianteId: 'negro', cantidad: 12 },
        { varianteId: 'marron', cantidad: 4 },
      ],
    );
    expect(tramos).toEqual([
      { varianteId: 'negro', ubicacion: 'Local', cantidad: 10 },
      { varianteId: 'negro', ubicacion: 'Depósito', cantidad: 2 },
      { varianteId: 'marron', ubicacion: 'Depósito', cantidad: 4 },
    ]);
  });

  it('ignora ubicaciones sin unidades', () => {
    const tramos = repartirPorUbicacion(
      [
        { ubicacion: null, stock: 5 },
        { ubicacion: 'Stand', stock: -2 },
      ],
      [{ varianteId: 'a', cantidad: 3 }],
    );
    expect(tramos).toEqual([{ varianteId: 'a', ubicacion: null, cantidad: 3 }]);
  });
});
