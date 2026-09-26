import { finDePrueba, limpiarNombre, normalizarTelefono, resumenPrimerosPasos } from './registro.util.js';

describe('registro propio', () => {
  it('la prueba dura 14 días corridos', () => {
    expect(finDePrueba('2026-09-26')).toBe('2026-10-10');
    expect(finDePrueba('2026-12-25')).toBe('2027-01-08');
  });

  it('limpia el nombre del negocio', () => {
    expect(limpiarNombre('  Acacia    Mates ')).toBe('Acacia Mates');
  });

  it('normaliza WhatsApp argentinos', () => {
    expect(normalizarTelefono('2615469432')).toBe('5492615469432');
    expect(normalizarTelefono('0261 15 546-9432')).toBe('5492615469432');
    expect(normalizarTelefono('+54 9 261 546 9432')).toBe('5492615469432');
    expect(normalizarTelefono('54 261 5469432')).toBe('5492615469432');
    expect(normalizarTelefono('+1 555 1234')).toBe('+1 555 1234');
  });

  it('guía de primeros pasos', () => {
    const nada = { productos: false, venta: false, compra: false, equipo: false, datosFiscales: false };
    expect(resumenPrimerosPasos(nada, 0)).toEqual({ hechos: 0, total: 5, mostrar: true });
    expect(resumenPrimerosPasos({ ...nada, productos: true, venta: true }, 3).hechos).toBe(2);
    expect(resumenPrimerosPasos(nada, 45).mostrar).toBe(false);
    expect(resumenPrimerosPasos({ productos: true, venta: true, compra: true, equipo: true, datosFiscales: true }, 2).mostrar).toBe(false);
  });
});
