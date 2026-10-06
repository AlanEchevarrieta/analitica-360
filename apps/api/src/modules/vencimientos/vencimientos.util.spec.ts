import { describe, expect, it } from 'vitest';
import { diasHabilesEntre, ultimoCorteMonotributo, vencimientoDolar, vencimientoTopes } from './vencimientos.util.js';

describe('diasHabilesEntre', () => {
  it('no cuenta sábados, domingos ni las puntas', () => {
    expect(diasHabilesEntre('2026-10-02', '2026-10-05')).toBe(0); // viernes → lunes
    expect(diasHabilesEntre('2026-10-05', '2026-10-07')).toBe(1); // falta el martes
    expect(diasHabilesEntre('2026-10-01', '2026-10-08')).toBe(4);
  });
});

describe('ultimoCorteMonotributo', () => {
  it('el 1/2 o el 1/8 que ya empezó', () => {
    expect(ultimoCorteMonotributo('2026-01-15')).toBe('2025-08-01');
    expect(ultimoCorteMonotributo('2026-02-01')).toBe('2026-02-01');
    expect(ultimoCorteMonotributo('2026-07-31')).toBe('2026-02-01');
    expect(ultimoCorteMonotributo('2026-10-06')).toBe('2026-08-01');
  });
});

describe('vencimientoDolar', () => {
  it('al día el lunes con la del viernes', () => {
    expect(vencimientoDolar('2026-10-02', '2026-10-05').estado).toBe('ok');
  });
  it('un día hábil sin dato es aviso (puede ser feriado); dos, vencido', () => {
    expect(vencimientoDolar('2026-10-05', '2026-10-07').estado).toBe('aviso');
    expect(vencimientoDolar('2026-10-05', '2026-10-08').estado).toBe('vencido');
  });
  it('sin datos, vencido', () => {
    expect(vencimientoDolar(null, '2026-10-06').estado).toBe('vencido');
  });
});

describe('vencimientoTopes', () => {
  it('al día si rigen desde el último corte o después', () => {
    const v = vencimientoTopes('2026-08-01', '2026-10-06');
    expect(v.estado).toBe('ok');
    expect(v.detalle).toContain('01/02/2027');
  });
  it('30 días de margen desde el corte, después vencido', () => {
    expect(vencimientoTopes('2026-02-01', '2026-08-20').estado).toBe('aviso');
    expect(vencimientoTopes('2026-02-01', '2026-09-15').estado).toBe('vencido');
  });
  it('los de febrero de 2025 hoy están vencidos', () => {
    const v = vencimientoTopes('2025-02-01', '2026-10-06');
    expect(v.estado).toBe('vencido');
    expect(v.queHacer).toContain('Topes del monotributo');
  });
});
