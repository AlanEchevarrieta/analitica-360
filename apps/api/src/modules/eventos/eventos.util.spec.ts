import { describe, expect, it } from 'vitest';
import { ESPERAS_BASE_MS, esErrorTemporal, espera, recortarTexto, vencioEsperaSinServicio } from './eventos.util.js';

describe('eventos.util', () => {
  it('espera(n) devuelve los tiempos escalonados dentro de ±10 %', () => {
    for (let i = 1; i <= ESPERAS_BASE_MS.length; i++) {
      const base = ESPERAS_BASE_MS[i - 1];
      const min = Math.round(base * 0.9);
      const max = Math.round(base * 1.1);
      expect(espera(i, 0)).toBe(min);
      expect(espera(i, 0.5)).toBe(base);
      expect(espera(i, 1)).toBe(max);
      const aleatorio = espera(i);
      expect(aleatorio).toBeGreaterThanOrEqual(min);
      expect(aleatorio).toBeLessThanOrEqual(max);
    }
    // Si supera el índice máximo, usa el tope de 24 h.
    expect(espera(99, 0.5)).toBe(24 * 3_600_000);
  });

  it('clasifica 429, 503, errores de red y falta de clave como temporales; 400 y 422 como definitivos', () => {
    expect(esErrorTemporal({ sinClave: true })).toBe(true);
    expect(esErrorTemporal({ status: 429 })).toBe(true);
    expect(esErrorTemporal({ status: 503 })).toBe(true);
    expect(esErrorTemporal({ status: 500 })).toBe(true);
    expect(esErrorTemporal({ status: null, mensaje: 'fetch failed: ECONNRESET' })).toBe(true);
    expect(esErrorTemporal({ status: 429, mensaje: 'daily quota exceeded' })).toBe(true);

    expect(esErrorTemporal({ status: 400, mensaje: 'Invalid to field' })).toBe(false);
    expect(esErrorTemporal({ status: 422, mensaje: 'Validation error' })).toBe(false);
    expect(esErrorTemporal({ status: null, mensaje: 'El email no es válido' })).toBe(false);
  });

  it('recorta textos largos para ultimoError y detalle', () => {
    expect(recortarTexto(null)).toBeNull();
    expect(recortarTexto('   ')).toBeNull();
    expect(recortarTexto('corto', 10)).toBe('corto');
    const largo = 'x'.repeat(1200);
    const recortado = recortarTexto(largo, 1000)!;
    expect(recortado.length).toBe(1000);
    expect(recortado.endsWith('…')).toBe(true);
  });

  it('detecta cuándo un evento superó los 35 días sin servicio', () => {
    const creado = new Date('2026-10-01T00:00:00Z');
    expect(vencioEsperaSinServicio(creado, new Date('2026-11-01T00:00:00Z'))).toBe(false);
    expect(vencioEsperaSinServicio(creado, new Date('2026-11-06T00:00:01Z'))).toBe(true);
  });
});
