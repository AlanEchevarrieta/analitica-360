import { acumularPct, armarSerieInflacion, finMesIso, mesAnteriorKey, mesesEnRango, mesKeyDe, promediarPorMes, rangoDatosIndec } from './inflacion.util.js';

describe('mesesEnRango', () => {
  it('devuelve las claves YYYY-MM entre desde y hasta, inclusive', () => {
    expect(mesesEnRango('2026-07-15', '2026-09-03')).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('un solo mes cuando desde y hasta caen en el mismo mes', () => {
    expect(mesesEnRango('2026-09-01', '2026-09-30')).toEqual(['2026-09']);
  });
});

describe('mesAnteriorKey / finMesIso / rangoDatosIndec', () => {
  it('retrocede un mes, cruzando de año si hace falta', () => {
    expect(mesAnteriorKey('2026-01')).toBe('2025-12');
    expect(mesAnteriorKey('2026-09')).toBe('2026-08');
  });

  it('calcula el último día del mes', () => {
    expect(finMesIso('2024-02-05')).toBe('2024-02-29'); // bisiesto
    expect(finMesIso('2026-09-01')).toBe('2026-09-30');
  });

  it('el rango de la tabla estática va de 2022-01 a fin de 2024-12', () => {
    expect(rangoDatosIndec()).toEqual({ desde: '2022-01-01', hasta: '2024-12-31' });
  });
});

describe('mesKeyDe', () => {
  it('extrae YYYY-MM de una fecha completa', () => {
    expect(mesKeyDe('2026-09-22T14:00:00Z')).toBe('2026-09');
  });
});

describe('promediarPorMes', () => {
  it('promedia solo precios positivos, ignora <= 0', () => {
    const res = promediarPorMes([
      { mes: '2026-01', precio: 100 },
      { mes: '2026-01', precio: 200 },
      { mes: '2026-01', precio: 0 },
      { mes: '2026-02', precio: 50 },
    ]);
    expect(res.get('2026-01')).toBe(150);
    expect(res.get('2026-02')).toBe(50);
  });
});

describe('acumularPct', () => {
  it('capitaliza variaciones mensuales compuestas', () => {
    expect(acumularPct([10, 10])).toBeCloseTo(0.21);
    expect(acumularPct([])).toBe(0);
  });
});

describe('armarSerieInflacion', () => {
  it('sin precios propios devuelve insight sin_datos aunque haya inflación', () => {
    const res = armarSerieInflacion(['2026-01', '2026-02'], { '2026-01': 5, '2026-02': 3 }, new Map(), '2026-01-01', '2026-02-28');
    expect(res.hayPrecios).toBe(false);
    expect(res.insight).toBe('sin_datos');
    expect(res.resumen.inflacionAcumuladaPct).toBeCloseTo(8.15, 1);
  });

  it('insight "menos" cuando los precios propios suben menos que la inflación', () => {
    // variacionPreciosPct compara solo los meses del rango pedido (2025-12 es el "mes anterior"
    // usado para la variación mes a mes de cada punto, no entra en el resumen acumulado).
    const precios = new Map([
      ['2025-12', 100],
      ['2026-01', 103],
      ['2026-02', 106],
    ]);
    const res = armarSerieInflacion(['2026-01', '2026-02'], { '2026-01': 5, '2026-02': 5 }, precios, '2026-01-01', '2026-02-28');
    expect(res.hayPrecios).toBe(true);
    expect(res.insight).toBe('menos');
    expect(res.resumen.variacionPreciosPct).toBeCloseTo(((106 - 103) / 103) * 100, 5);
    expect(res.resumen.diferenciaPct).toBeLessThan(0);
  });

  it('valorRealDe100 refleja pérdida de poder adquisitivo cuando el precio propio queda fijo y la inflación sube', () => {
    const precios = new Map([
      ['2025-12', 100],
      ['2026-01', 105],
      ['2026-02', 105],
    ]);
    const res = armarSerieInflacion(['2026-01', '2026-02'], { '2026-01': 10, '2026-02': 10 }, precios, '2026-01-01', '2026-02-28');
    expect(res.resumen.variacionPreciosPct).toBeCloseTo(0, 5);
    expect(res.resumen.valorRealDe100).toBeLessThan(100);
  });
});
