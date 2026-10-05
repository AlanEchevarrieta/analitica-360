import { Prisma } from '@prisma/client';
import { sumarDiasIso } from '../analytics/analytics.util.js';

export type CasaDolar = 'blue' | 'oficial' | 'bolsa';
export const CASAS_DOLAR: CasaDolar[] = ['blue', 'oficial', 'bolsa'];

/**
 * Pasa pesos a dólares con la cotización del día de cada movimiento (si no hubo
 * cotización ese día, la del último anterior). En pesos, no toca nada.
 */
export interface Conversor {
  /** null = pesos. */
  casa: CasaDolar | null;
  /** Cotización (venta) de un día AAAA-MM-DD. */
  tasa(dia: string): number;
  /** Monto de ese día en la moneda pedida. */
  a(monto: number, dia: string): number;
  /** Cotización de hoy (para lo que no tiene fecha: stock a costo actual, precios actuales). */
  hoy: number;
  /**
   * Factor para multiplicar un monto en SQL: 1 en pesos, 1/cotización del día en dólares.
   * `dia` es una expresión de tipo date (ej. diaAR(v.fecha)). Va como una lista con la
   * cotización de cada día del rango (buscar por posición es mucho más rápido que una
   * subconsulta por fila).
   */
  factor(dia: Prisma.Sql): Prisma.Sql;
}

export const EN_PESOS: Conversor = { casa: null, tasa: () => 1, a: (m) => m, hoy: 1, factor: () => Prisma.sql`1` };

/**
 * Arma el conversor a partir de las cotizaciones ordenadas por fecha. `desde`/`hasta`
 * es el rango de días que se va a consultar en SQL (fuera de él, el extremo más cercano).
 */
export function conversorDesde(casa: CasaDolar, filas: { fecha: string; venta: number }[], hoyDia: string, desde: string, hasta: string): Conversor {
  const fechas = filas.map((f) => f.fecha);
  const valores = filas.map((f) => f.venta);
  const tasa = (dia: string): number => {
    if (!fechas.length) return NaN;
    // Búsqueda binaria: la última fecha <= dia (antes del primer dato, el primero).
    if (dia < fechas[0]) return valores[0];
    let lo = 0;
    let hi = fechas.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (fechas[mid] <= dia) lo = mid;
      else hi = mid - 1;
    }
    return valores[lo];
  };
  const fin = hasta > hoyDia ? hasta : hoyDia;
  // Un valor por día, sin huecos (fines de semana y feriados: el del día hábil anterior).
  const lista: number[] = [];
  for (let d = desde; d <= fin; d = sumarDiasIso(d, 1)) lista.push(tasa(d));
  const factor = (dia: Prisma.Sql) =>
    Prisma.sql`(1.0 / ((${lista}::float8[])[LEAST(GREATEST((${dia}) - ${desde}::date + 1, 1), ${lista.length})])::numeric)`;
  return { casa, tasa, a: (m, dia) => m / tasa(dia), hoy: tasa(hoyDia), factor };
}
