import { describe, expect, it } from 'vitest';
import { correspondeAviso, evaluar, periodosAnteriores, rangoPeriodo } from './objetivos.util.js';

describe('rangoPeriodo', () => {
  it('semana de lunes a domingo', () => {
    expect(rangoPeriodo('semana', '2026-10-08')).toEqual({ desde: '2026-10-05', hasta: '2026-10-11' }); // jueves
    expect(rangoPeriodo('semana', '2026-10-11')).toEqual({ desde: '2026-10-05', hasta: '2026-10-11' }); // domingo
    expect(rangoPeriodo('semana', '2026-10-05')).toEqual({ desde: '2026-10-05', hasta: '2026-10-11' }); // lunes
  });
  it('mes, trimestre y año', () => {
    expect(rangoPeriodo('mes', '2026-02-10')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(rangoPeriodo('trimestre', '2026-11-30')).toEqual({ desde: '2026-10-01', hasta: '2026-12-31' });
    expect(rangoPeriodo('anio', '2026-06-01')).toEqual({ desde: '2026-01-01', hasta: '2026-12-31' });
  });
});

describe('periodosAnteriores', () => {
  it('los cerrados, del más reciente al más viejo', () => {
    expect(periodosAnteriores('mes', '2026-01-15', 2)).toEqual([
      { desde: '2025-12-01', hasta: '2025-12-31' },
      { desde: '2025-11-01', hasta: '2025-11-30' },
    ]);
  });
});

describe('evaluar', () => {
  const octubre = { desde: '2026-10-01', hasta: '2026-10-31' };

  it('acumulativo en curso: ritmo y proyección', () => {
    // Día 10 de 31, vendió 3,0 M de 8 M: va al 37,5 % y debería ir al 32,3 %; proyecta 9,3 M.
    const a = evaluar('facturacion', 8_000_000, 3_000_000, octubre, '2026-10-10');
    expect(a.porcentaje).toBe(37.5);
    expect(a.esperado).toBe(32.3);
    expect(a.proyeccion).toBe(9_300_000);
    expect(a.semaforo).toBe('bien');
  });

  it('justo si proyecta entre 90 % y 100 %, mal si menos', () => {
    expect(evaluar('facturacion', 10_000_000, 3_000_000, octubre, '2026-10-10').semaforo).toBe('justo'); // proyecta 9,3 M
    expect(evaluar('facturacion', 12_000_000, 3_000_000, octubre, '2026-10-10').semaforo).toBe('mal');
  });

  it('período cerrado: se juzga el valor final, sin proyección', () => {
    const a = evaluar('produccion', 400, 410, octubre, '2026-11-02');
    expect(a).toMatchObject({ porcentaje: 102.5, proyeccion: null, semaforo: 'bien' });
  });

  it('días de despacho: menos es mejor', () => {
    expect(evaluar('dias_despacho', 2, 1.5, octubre, '2026-10-10').semaforo).toBe('bien');
    expect(evaluar('dias_despacho', 2, 2.3, octubre, '2026-10-10').semaforo).toBe('justo');
    expect(evaluar('dias_despacho', 2, 3, octubre, '2026-10-10').semaforo).toBe('mal');
  });

  it('a tiempo: porcentaje con 5 puntos de margen', () => {
    expect(evaluar('a_tiempo', 95, 96, octubre, '2026-10-10').semaforo).toBe('bien');
    expect(evaluar('a_tiempo', 95, 91, octubre, '2026-10-10').semaforo).toBe('justo');
    expect(evaluar('a_tiempo', 95, 80, octubre, '2026-10-10').semaforo).toBe('mal');
  });

  it('sin datos', () => {
    expect(evaluar('dias_despacho', 2, null, octubre, '2026-10-10').semaforo).toBe('sin_datos');
  });
});

describe('tipos nuevos y avisos', () => {
  const octubre = { desde: '2026-10-01', hasta: '2026-10-31' };

  it('ticket promedio: 10 % de margen; la meta del período viaja en el avance', () => {
    expect(evaluar('ticket_promedio', 20_000, 19_000, octubre, '2026-10-10')).toMatchObject({ semaforo: 'justo', meta: 20_000, proyeccion: null });
    expect(evaluar('ticket_promedio', 20_000, 17_000, octubre, '2026-10-10').semaforo).toBe('mal');
  });

  it('clientes nuevos, unidades y cobranza se proyectan', () => {
    expect(evaluar('clientes_nuevos', 31, 10, octubre, '2026-10-10').proyeccion).toBe(31);
  });

  it('avisa solo si pasó un cuarto del período, va en rojo y sigue abierto', () => {
    const rojo = evaluar('facturacion', 12_000_000, 3_000_000, octubre, '2026-10-10');
    expect(correspondeAviso('facturacion', rojo, '2026-10-10')).toBe(true);
    expect(correspondeAviso('facturacion', evaluar('facturacion', 12_000_000, 300_000, octubre, '2026-10-03'), '2026-10-03')).toBe(false); // muy temprano
    expect(correspondeAviso('facturacion', evaluar('facturacion', 8_000_000, 3_000_000, octubre, '2026-10-10'), '2026-10-10')).toBe(false); // va bien
    expect(correspondeAviso('dias_despacho', evaluar('dias_despacho', 2, 5, octubre, '2026-10-20'), '2026-10-20')).toBe(false); // no acumulativo
  });
});
