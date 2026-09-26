import { baseSku, codigoDe, generarSku, normalizarSku } from './sku.util.js';

describe('SKU automático', () => {
  it('toma 3 letras por palabra, sin tildes ni palabras vacías', () => {
    expect(codigoDe('Mate Imperial', 2)).toBe('MATIMP');
    expect(codigoDe('Mate de caballo de calabaza', 2)).toBe('MATCAB');
    expect(codigoDe('Neceser', 2)).toBe('NEC');
    expect(codigoDe('Fútbol', 1)).toBe('FUT');
    expect(codigoDe('', 1)).toBe('');
  });

  it('arma CATEGORIA-PRODUCTO-VARIANTE', () => {
    expect(baseSku({ categoria: 'Mates', producto: 'Mate Imperial', valores: ['Negro'] })).toBe('MAT-MATIMP-NEG');
    expect(baseSku({ categoria: 'Bolsos', producto: 'Bolso Matero', valores: ['Negro', 'Grande'] })).toBe('BOL-BOLMAT-NEGGRA');
    expect(baseSku({ categoria: null, producto: 'Termo' })).toBe('GEN-TER');
  });

  it('numera para no repetir', () => {
    const usados = new Set(['MAT-MATIMP-NEG-001']);
    expect(generarSku({ categoria: 'Mates', producto: 'Mate Imperial', valores: ['Negro'] }, usados)).toBe('MAT-MATIMP-NEG-002');
    expect(generarSku({ categoria: 'Mates', producto: 'Mate Imperial', valores: ['Negro'] }, usados)).toBe('MAT-MATIMP-NEG-003');
    expect(generarSku({ categoria: 'Mates', producto: 'Mate Imperial', valores: ['Marrón'] }, usados)).toBe('MAT-MATIMP-MAR-001');
  });

  it('normaliza el SKU cargado a mano', () => {
    expect(normalizarSku('  abc 123 ')).toBe('ABC-123');
    expect(normalizarSku('')).toBeNull();
    expect(normalizarSku(null)).toBeNull();
  });
});
