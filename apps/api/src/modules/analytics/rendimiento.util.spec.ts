import { periodoAnterior, rendimiento } from './rendimiento.util.js';

describe('rendimiento por stand y por vendedor', () => {
  it('participación, ticket promedio y variación', () => {
    const r = rendimiento(
      [
        { clave: 'parque', nombre: 'Stand Parque', ventas: 10, total: 250_000 },
        { clave: 'garibaldi', nombre: 'Stand Garibaldi', ventas: 30, total: 750_000 },
      ],
      [{ clave: 'garibaldi', nombre: 'Stand Garibaldi', ventas: 25, total: 600_000 }],
    );
    expect(r.map((f) => [f.nombre, f.pct, f.ticket, f.variacion])).toEqual([
      ['Stand Garibaldi', 75, 25_000, 25],
      ['Stand Parque', 25, 25_000, null],
    ]);
  });

  it('sin ventas: todo en cero', () => {
    expect(rendimiento([], [])).toEqual([]);
    expect(rendimiento([{ clave: 'x', nombre: 'X', ventas: 0, total: 0 }], [])[0]).toMatchObject({ pct: 0, ticket: 0 });
  });

  it('período anterior de la misma duración', () => {
    expect(periodoAnterior('2026-09-01', '2026-09-30')).toEqual({ desde: '2026-08-02', hasta: '2026-08-31' });
    expect(periodoAnterior('2026-09-20', '2026-09-26')).toEqual({ desde: '2026-09-13', hasta: '2026-09-19' });
  });
});
