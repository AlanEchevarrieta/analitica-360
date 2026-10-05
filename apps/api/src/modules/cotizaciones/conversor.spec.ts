import { describe, expect, it } from 'vitest';
import { conversorDesde, EN_PESOS } from './conversor.js';

const filas = [
  { fecha: '2026-09-01', venta: 1000 },
  { fecha: '2026-09-04', venta: 1250 }, // viernes; sábado y domingo no hay cotización
  { fecha: '2026-09-07', venta: 1300 },
];

describe('conversor de dólares', () => {
  const c = conversorDesde('blue', filas, '2026-09-08', '2026-09-01', '2026-09-08');

  it('usa la cotización del día o la del último día anterior (fines de semana)', () => {
    expect(c.tasa('2026-09-01')).toBe(1000);
    expect(c.tasa('2026-09-03')).toBe(1000);
    expect(c.tasa('2026-09-05')).toBe(1250);
    expect(c.tasa('2026-09-06')).toBe(1250);
    expect(c.tasa('2026-09-07')).toBe(1300);
  });

  it('antes del primer dato, la primera; hoy, la última', () => {
    expect(c.tasa('2020-01-01')).toBe(1000);
    expect(c.hoy).toBe(1300);
  });

  it('pasa cada monto con la cotización de su día', () => {
    expect(c.a(10_000, '2026-09-02')).toBe(10);
    expect(c.a(10_000, '2026-09-06')).toBe(8);
  });

  it('en SQL va una lista con un valor por día (sin huecos)', () => {
    const sql = c.factor({ sql: 'x', values: [], strings: ['x'] } as never);
    expect(sql.values[0]).toEqual([1000, 1000, 1000, 1250, 1250, 1250, 1300, 1300]);
  });

  it('en pesos no cambia nada', () => {
    expect(EN_PESOS.a(123, '2026-09-01')).toBe(123);
    expect(EN_PESOS.casa).toBeNull();
  });
});
