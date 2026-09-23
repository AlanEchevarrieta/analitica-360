import { acumuladoSerie, mesesAtras, proyectarFlujo, ratiosFinancieros, semaforoMargenBruto, semaforoMargenNeto, serieMensual, sumarPeriodo, type PuntoMes } from './contabilidad.util.js';

describe('mesesAtras', () => {
  it('devuelve las últimas N claves YYYY-MM terminando en el mes de hoy', () => {
    expect(mesesAtras('2026-09-22', 6)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  });

  it('cruza el límite de año', () => {
    expect(mesesAtras('2026-02-10', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('sumarPeriodo', () => {
  it('suma ingresos/COGS/gastos solo dentro del rango pedido', () => {
    const ventas = [
      { id: 'v1', fecha: '2026-09-05', total: 1000 },
      { id: 'v2', fecha: '2026-08-01', total: 500 }, // fuera de rango
    ];
    const items = [
      { ventaId: 'v1', cogs: 400 },
      { ventaId: 'v2', cogs: 200 },
    ];
    const gastos = [
      { fecha: '2026-09-10', monto: 100, recurrente: false },
      { fecha: '2026-08-15', monto: 50, recurrente: true }, // fuera de rango
    ];
    const res = sumarPeriodo(ventas, items, gastos, '2026-09-01', '2026-09-30');
    expect(res).toEqual({ ingresos: 1000, cogs: 400, gastos: 100, neto: 500, cantidadVentas: 1 });
  });
});

describe('serieMensual', () => {
  it('agrupa ventas/COGS/gastos por clave de mes', () => {
    const ventas = [
      { id: 'v1', fecha: '2026-08-05', total: 100 },
      { id: 'v2', fecha: '2026-09-05', total: 200 },
    ];
    const items = [
      { ventaId: 'v1', cogs: 40 },
      { ventaId: 'v2', cogs: 80 },
    ];
    const gastos = [
      { fecha: '2026-09-01', monto: 30, recurrente: false },
    ];
    const res = serieMensual(['2026-08', '2026-09'], ventas, items, gastos);
    expect(res).toEqual([
      { clave: '2026-08', ingresos: 100, cogs: 40, gastos: 0, resultado: 60 },
      { clave: '2026-09', ingresos: 200, cogs: 80, gastos: 30, resultado: 90 },
    ]);
  });
});

describe('ratiosFinancieros', () => {
  it('calcula margen bruto/neto, punto de equilibrio, ROI, días de inventario y ticket', () => {
    const res = ratiosFinancieros({ ingresos: 1000, cogs: 400, gastos: 200, cantidadVentas: 10, valorInventario: 600, gastosFijos: 200 });
    expect(res.margenBrutoPct).toBeCloseTo(60);
    expect(res.margenNetoPct).toBeCloseTo(40);
    expect(res.neto).toBe(400);
    expect(res.puntoEquilibrio).toBeCloseTo(200 / 0.6);
    expect(res.roiPct).toBeCloseTo((400 / 600) * 100);
    expect(res.ticket).toBe(100);
  });

  it('sin ingresos, margenes y ticket quedan en 0 (no división por cero)', () => {
    const res = ratiosFinancieros({ ingresos: 0, cogs: 0, gastos: 0, cantidadVentas: 0, valorInventario: 0, gastosFijos: 0 });
    expect(res.margenBrutoPct).toBe(0);
    expect(res.margenNetoPct).toBe(0);
    expect(res.puntoEquilibrio).toBe(0);
    expect(res.roiPct).toBe(0);
    expect(res.diasInventario).toBe(0);
    expect(res.ticket).toBe(0);
  });
});

describe('semaforoMargenBruto / semaforoMargenNeto', () => {
  it('clasifica en verde/amarillo/rojo con los umbrales del legacy', () => {
    expect(semaforoMargenBruto(51)).toBe('verde');
    expect(semaforoMargenBruto(30)).toBe('amarillo');
    expect(semaforoMargenBruto(29)).toBe('rojo');
    expect(semaforoMargenNeto(21)).toBe('verde');
    expect(semaforoMargenNeto(10)).toBe('amarillo');
    expect(semaforoMargenNeto(9)).toBe('rojo');
  });
});

describe('proyectarFlujo', () => {
  it('proyecta usando el promedio de los últimos 3 puntos de la serie', () => {
    const serie6: PuntoMes[] = [
      { clave: '2026-04', ingresos: 100, cogs: 40, gastos: 10, resultado: 50 },
      { clave: '2026-05', ingresos: 100, cogs: 40, gastos: 10, resultado: 50 },
      { clave: '2026-06', ingresos: 100, cogs: 40, gastos: 10, resultado: 50 },
      { clave: '2026-07', ingresos: 200, cogs: 80, gastos: 20, resultado: 100 },
      { clave: '2026-08', ingresos: 200, cogs: 80, gastos: 20, resultado: 100 },
      { clave: '2026-09', ingresos: 200, cogs: 80, gastos: 20, resultado: 100 },
    ];
    const res = proyectarFlujo(serie6, 3);
    expect(res).toHaveLength(3);
    expect(res[0].ingresos).toBe(200);
    expect(res[0].resultado).toBe(100);
  });
});

describe('acumuladoSerie', () => {
  it('acumula el resultado punto a punto', () => {
    const puntos: PuntoMes[] = [
      { clave: '2026-08', ingresos: 100, cogs: 40, gastos: 10, resultado: 50 },
      { clave: '2026-09', ingresos: 80, cogs: 30, gastos: 10, resultado: 40 },
    ];
    const res = acumuladoSerie(puntos);
    expect(res.map((p) => p.acumulado)).toEqual([50, 90]);
  });
});
