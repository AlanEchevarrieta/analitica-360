import { mismaCombinacion, normalizarAtributos, promedioPonderado } from './variantes.util.js';

describe('normalizarAtributos', () => {
  it('recorta claves/valores y descarta claves vacías', () => {
    expect(normalizarAtributos({ ' Color ': ' Rojo ', '': 'x', Talle: 'M' })).toEqual({
      Color: 'Rojo',
      Talle: 'M',
    });
  });

  it('devuelve {} para valores no-objeto (null, array, string)', () => {
    expect(normalizarAtributos(null)).toEqual({});
    expect(normalizarAtributos(undefined)).toEqual({});
    expect(normalizarAtributos([] as unknown as Record<string, unknown>)).toEqual({});
  });
});

describe('mismaCombinacion', () => {
  it('true cuando mismas claves/valores en cualquier orden', () => {
    expect(mismaCombinacion({ Color: 'Rojo', Talle: 'M' }, { Talle: 'M', Color: 'Rojo' })).toBe(true);
  });

  it('false cuando difiere una clave o cantidad de claves', () => {
    expect(mismaCombinacion({ Color: 'Rojo' }, { Color: 'Azul' })).toBe(false);
    expect(mismaCombinacion({ Color: 'Rojo' }, { Color: 'Rojo', Talle: 'M' })).toBe(false);
  });
});

describe('promedioPonderado', () => {
  it('sin stock (peso 0) cae a promedio simple de los valores > 0', () => {
    const resultado = promedioPonderado([
      { valor: 100, stock: 0 },
      { valor: 200, stock: 0 },
    ]);
    expect(resultado).toBe(150);
  });

  it('con stock, pondera por stock', () => {
    const resultado = promedioPonderado([
      { valor: 100, stock: 3 },
      { valor: 200, stock: 1 },
    ]);
    // (100*3 + 200*1) / 4 = 125
    expect(resultado).toBe(125);
  });

  it('ignora valores <= 0 o no finitos', () => {
    const resultado = promedioPonderado([
      { valor: 0, stock: 5 },
      { valor: 100, stock: 0 },
    ]);
    expect(resultado).toBe(100);
  });

  it('null cuando no hay ningún valor válido', () => {
    expect(promedioPonderado([])).toBeNull();
    expect(promedioPonderado([{ valor: 0, stock: 1 }])).toBeNull();
  });
});
