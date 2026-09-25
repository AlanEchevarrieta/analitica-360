import { aFechaSolo } from './fecha-solo.js';

describe('aFechaSolo', () => {
  it('convierte AAAA-MM-DD a medianoche UTC (sin corrimiento de día)', () => {
    expect(aFechaSolo('1990-09-27')!.toISOString()).toBe('1990-09-27T00:00:00.000Z');
  });
  it('vacío o inválido da null', () => {
    expect(aFechaSolo(null)).toBeNull();
    expect(aFechaSolo('')).toBeNull();
    expect(aFechaSolo('no-es-fecha')).toBeNull();
  });
});
