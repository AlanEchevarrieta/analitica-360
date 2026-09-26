import { fechaUtc } from './prisma-periodo.repository.js';

describe('fechaUtc', () => {
  it('toma como UTC una fecha sin zona (como llega de un timestamp en JSON)', () => {
    expect(fechaUtc('2026-09-16T15:00:00').toISOString()).toBe('2026-09-16T15:00:00.000Z');
    expect(fechaUtc('2026-09-16T15:00:00.123').toISOString()).toBe('2026-09-16T15:00:00.123Z');
  });

  it('respeta la zona si ya viene', () => {
    expect(fechaUtc('2026-09-16T15:00:00Z').toISOString()).toBe('2026-09-16T15:00:00.000Z');
    expect(fechaUtc('2026-09-16T12:00:00-03:00').toISOString()).toBe('2026-09-16T15:00:00.000Z');
  });
});
