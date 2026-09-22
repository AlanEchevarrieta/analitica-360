import { etiquetaDiaEs, inicioMesIso, lunesIso, sumarDiasIso } from './analytics.util.js';

describe('lunesIso', () => {
  it('devuelve el mismo día si ya es lunes', () => {
    expect(lunesIso('2026-09-21')).toBe('2026-09-21'); // 21/09/2026 es lunes
  });

  it('retrocede hasta el lunes de la semana para el resto de los días', () => {
    expect(lunesIso('2026-09-25')).toBe('2026-09-21'); // viernes -> lunes
    expect(lunesIso('2026-09-27')).toBe('2026-09-21'); // domingo -> lunes de esa semana
  });
});

describe('etiquetaDiaEs', () => {
  it('mapea cada día de la semana a su abreviatura en español', () => {
    expect(etiquetaDiaEs('2026-09-21')).toBe('lun');
    expect(etiquetaDiaEs('2026-09-22')).toBe('mar');
    expect(etiquetaDiaEs('2026-09-27')).toBe('dom');
  });
});

describe('inicioMesIso', () => {
  it('trunca al primer día del mes', () => {
    expect(inicioMesIso('2026-09-22')).toBe('2026-09-01');
  });
});

describe('sumarDiasIso', () => {
  it('suma y resta días cruzando meses', () => {
    expect(sumarDiasIso('2026-09-30', 1)).toBe('2026-10-01');
    expect(sumarDiasIso('2026-10-01', -1)).toBe('2026-09-30');
  });
});
