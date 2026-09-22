import { coincideMargen, esBusquedaCodigoBarras } from './productos.util.js';

describe('esBusquedaCodigoBarras', () => {
  it.each([
    ['123456789', true],
    ['12345678', false], // 8 dígitos exactos - no alcanza (> 8, no >=)
    ['abc123456789', false],
    ['', false],
    ['   123456789   ', true],
  ])('esBusquedaCodigoBarras(%s) -> %s', (texto, esperado) => {
    expect(esBusquedaCodigoBarras(texto)).toBe(esperado);
  });
});

describe('coincideMargen', () => {
  it.each([
    ['todos', 100, 90, true],
    ['alto', 100, 50, true], // margen 50% > 40
    ['alto', 100, 65, false], // margen 35%
    ['medio', 100, 65, true], // margen 35% en [20,40]
    ['medio', 100, 90, false], // margen 10%
    ['bajo', 100, 90, true], // margen 10% < 20
    ['bajo', 100, 50, false], // margen 50%
  ] as const)('coincideMargen(%s, precio=%d, costo=%d) -> %s', (margen, precio, costo, esperado) => {
    expect(coincideMargen(margen, precio, costo)).toBe(esperado);
  });

  it('devuelve false para cualquier bucket cuando falta precio o costo', () => {
    expect(coincideMargen('alto', null, 10)).toBe(false);
    expect(coincideMargen('alto', 10, null)).toBe(false);
    expect(coincideMargen('alto', 0, 10)).toBe(false); // precioVenta <= 0
  });

  it('"todos" siempre matchea, incluso sin precio/costo', () => {
    expect(coincideMargen('todos', null, null)).toBe(true);
  });
});
