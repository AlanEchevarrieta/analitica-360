import { filasDesdeMatriz, partirEnLotes } from './productos-import.util.js';

describe('filasDesdeMatriz', () => {
  it('matchea columnas por contenido de encabezado, sin importar el orden', () => {
    const rows = [
      ['Costo', 'Nombre', 'Stock inicial', 'Precio de venta', 'Categoría'],
      [8000, 'Remera básica', '10', 15000, 'Indumentaria'],
    ];
    const res = filasDesdeMatriz(rows);
    expect(res).toEqual([{ nombre: 'Remera básica', categoria: 'Indumentaria', precioVenta: 15000, costo: 8000, stockInicial: 10 }]);
  });

  it('descarta filas sin nombre', () => {
    const rows = [
      ['Nombre', 'Categoría', 'Precio de venta', 'Costo', 'Stock inicial'],
      ['', 'X', 100, 50, 1],
      ['Producto válido', 'X', 100, 50, 1],
    ];
    expect(filasDesdeMatriz(rows)).toHaveLength(1);
  });

  it('matriz vacía devuelve []', () => {
    expect(filasDesdeMatriz([])).toEqual([]);
  });
});

describe('partirEnLotes', () => {
  it('parte en lotes de 50 por defecto', () => {
    const filas = Array.from({ length: 120 }, (_, i) => i);
    const lotes = partirEnLotes(filas);
    expect(lotes).toHaveLength(3);
    expect(lotes[0]).toHaveLength(50);
    expect(lotes[2]).toHaveLength(20);
  });
});
