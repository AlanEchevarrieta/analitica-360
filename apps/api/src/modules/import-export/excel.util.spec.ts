import { celdaEsNumero, claveColumna, claveNombre, enteroCelda, numeroCelda, parseFechaCelda, textoCelda } from './excel.util.js';

describe('numeroCelda', () => {
  it('parsea formato argentino (con miles Y decimales) y formato con solo punto decimal', () => {
    expect(numeroCelda('$ 15.000,50')).toBeCloseTo(15000.5);
    expect(numeroCelda('1234.56')).toBeCloseTo(1234.56);
    expect(numeroCelda(42)).toBe(42);
  });

  it('un único punto se interpreta como decimal, no como separador de miles (igual que el legacy)', () => {
    expect(numeroCelda('15.000')).toBeCloseTo(15);
  });

  it('devuelve 0 para valores no numéricos', () => {
    expect(numeroCelda('abc')).toBe(0);
    expect(numeroCelda(undefined)).toBe(0);
  });
});

describe('enteroCelda', () => {
  it('trunca y nunca es negativo', () => {
    expect(enteroCelda('10.7')).toBe(10);
    expect(enteroCelda('-5')).toBe(0);
  });
});

describe('textoCelda / celdaEsNumero', () => {
  it('textoCelda trimea y castea a string', () => {
    expect(textoCelda('  Remera  ')).toBe('Remera');
    expect(textoCelda(null)).toBe('');
  });

  it('celdaEsNumero acepta un único separador decimal, no miles+decimales combinados', () => {
    expect(celdaEsNumero('1234,56')).toBe(true);
    expect(celdaEsNumero('1234.56')).toBe(true);
    expect(celdaEsNumero('1.234,56')).toBe(false); // dos separadores - no matchea el regex del legacy
    expect(celdaEsNumero('Remera')).toBe(false);
    expect(celdaEsNumero('')).toBe(false);
  });
});

describe('claveColumna / claveNombre', () => {
  it('normaliza tildes y mayúsculas para matchear encabezados', () => {
    expect(claveColumna('Categoría')).toBe('categoria');
    expect(claveColumna('  Precio de Venta ')).toBe('precio de venta');
  });

  it('claveNombre normaliza para deduplicar', () => {
    expect(claveNombre('  Remera Básica ')).toBe('remera básica');
  });
});

describe('parseFechaCelda', () => {
  it('parsea fechas ISO y DD/MM/AAAA', () => {
    expect(parseFechaCelda('2026-09-22')).toBe('2026-09-22');
    expect(parseFechaCelda('22/09/2026')).toBe('2026-09-22');
    expect(parseFechaCelda('22/09/26')).toBe('2026-09-22');
  });

  it('parsea un objeto Date (celda de Excel con cellDates:true)', () => {
    expect(parseFechaCelda(new Date(2026, 8, 22))).toBe('2026-09-22');
  });

  it('devuelve null para valores no parseables o fechas inválidas', () => {
    expect(parseFechaCelda('no es fecha')).toBeNull();
    expect(parseFechaCelda('32/13/2026')).toBeNull();
    expect(parseFechaCelda('')).toBeNull();
  });
});
