/**
 * Puerto fiel de src/lib/inflacion.ts (comparación de la variación de
 * precios propios contra la inflación real de Argentina).
 *
 * `resolverPeriodoInflacion` del legacy (lee `window.location.search` y
 * localStorage para default de período) es presentación/UI del navegador,
 * no lógica de negocio - queda en el frontend Next.js. El backend recibe
 * `desde`/`hasta` como query params obligatorios, igual criterio que
 * analytics_periodo. `labelMesCorto` (formato es-AR del mes) también queda
 * para el frontend - se devuelve `mesKey` (YYYY-MM) crudo.
 */

/** Índice de inflación mensual INDEC (IPC nacional, % mensual) - dato estático, igual que en el legacy. */
export const INFLACION_INDEC: Record<string, number> = {
  '2022-01': 3.9,
  '2022-02': 4.7,
  '2022-03': 6.7,
  '2022-04': 6.0,
  '2022-05': 5.1,
  '2022-06': 5.3,
  '2022-07': 7.4,
  '2022-08': 7.0,
  '2022-09': 6.2,
  '2022-10': 6.3,
  '2022-11': 4.9,
  '2022-12': 5.1,
  '2023-01': 6.0,
  '2023-02': 6.6,
  '2023-03': 7.7,
  '2023-04': 8.4,
  '2023-05': 7.8,
  '2023-06': 6.0,
  '2023-07': 6.3,
  '2023-08': 12.4,
  '2023-09': 12.7,
  '2023-10': 8.3,
  '2023-11': 12.8,
  '2023-12': 25.5,
  '2024-01': 20.6,
  '2024-02': 13.2,
  '2024-03': 11.0,
  '2024-04': 8.8,
  '2024-05': 4.2,
  '2024-06': 4.6,
  '2024-07': 4.0,
  '2024-08': 4.2,
  '2024-09': 3.5,
  '2024-10': 2.4,
  '2024-11': 2.4,
  '2024-12': 2.7,
};

export interface PuntoInflacionPrecios {
  mesKey: string;
  inflacion: number | null;
  variacion: number | null;
  diferencia: number | null;
}

export interface ResumenInflacion {
  inflacionAcumuladaPct: number | null;
  variacionPreciosPct: number | null;
  diferenciaPct: number | null;
  valorRealDe100: number | null;
}

export type InsightInflacion = 'menos' | 'mas' | 'sin_datos';

export interface SerieInflacionPrecios {
  puntos: PuntoInflacionPrecios[];
  hayPrecios: boolean;
  insight: InsightInflacion;
  resumen: ResumenInflacion;
  errorInflacion: string | null;
  desde: string;
  hasta: string;
}

const RESUMEN_VACIO: ResumenInflacion = { inflacionAcumuladaPct: null, variacionPreciosPct: null, diferenciaPct: null, valorRealDe100: null };
const MSG_SIN_INFLACION = 'Datos de inflación no disponibles para este período';

export const SERIE_INFLACION_VACIA: SerieInflacionPrecios = {
  puntos: [],
  hayPrecios: false,
  insight: 'sin_datos',
  resumen: RESUMEN_VACIO,
  errorInflacion: null,
  desde: '',
  hasta: '',
};

/** Puerto de mesesEnRango (src/lib/inflacion.ts): claves YYYY-MM entre desde y hasta, inclusive. */
export function mesesEnRango(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let cur = `${desde.slice(0, 7)}-01`.slice(0, 7);
  const fin = hasta.slice(0, 7);
  while (cur <= fin) {
    out.push(cur);
    const [y, m] = cur.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m, 1));
    cur = dt.toISOString().slice(0, 7);
  }
  return out;
}

/** Puerto de mesAnteriorKey. */
export function mesAnteriorKey(mesKey: string): string {
  const [y, m] = mesKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 2, 1));
  return dt.toISOString().slice(0, 7);
}

/** Puerto de finMesIso: último día del mes de `iso`. */
export function finMesIso(iso: string): string {
  const [y, m] = iso.slice(0, 7).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m, 0));
  return dt.toISOString().slice(0, 10);
}

/** Puerto de rangoDatosIndec: rango cubierto por la tabla estática INFLACION_INDEC. */
export function rangoDatosIndec(): { desde: string; hasta: string } {
  const keys = Object.keys(INFLACION_INDEC).sort();
  const first = keys[0];
  const last = keys[keys.length - 1];
  return { desde: `${first}-01`, hasta: finMesIso(`${last}-01`) };
}

/** Puerto de mesKeyDe: YYYY-MM de una fecha ISO (o parseable). */
export function mesKeyDe(fecha: string): string {
  const m = String(fecha).match(/^(\d{4}-\d{2})/);
  return m ? m[1] : String(fecha).slice(0, 7);
}

/** Puerto de promediarPorMes: precio promedio por mes, ignorando precios <= 0. */
export function promediarPorMes(filas: { mes: string; precio: number }[]): Map<string, number> {
  const acc = new Map<string, { suma: number; n: number }>();
  for (const f of filas) {
    if (!f.mes || !(f.precio > 0)) continue;
    const prev = acc.get(f.mes) ?? { suma: 0, n: 0 };
    prev.suma += f.precio;
    prev.n += 1;
    acc.set(f.mes, prev);
  }
  const map = new Map<string, number>();
  for (const [mes, v] of acc) if (v.n > 0) map.set(mes, v.suma / v.n);
  return map;
}

/** Puerto de acumularPct: capitalización compuesta de una lista de variaciones % mensuales. */
export function acumularPct(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((acc, p) => acc * (1 + p / 100), 1) - 1;
}

/**
 * Puerto del cuerpo de armado de cargarInflacionVsPrecios (todo lo posterior
 * a cargar `inflacion` y `precios`): arma los puntos mes a mes y el resumen
 * acumulado/comparativo. Función pura, separada de la carga de datos para
 * poder testearla sin mocks de repositorio.
 */
export function armarSerieInflacion(
  meses: string[],
  inflacion: Record<string, number>,
  precios: Map<string, number>,
  desde: string,
  hasta: string,
): SerieInflacionPrecios {
  const puntos: PuntoInflacionPrecios[] = meses.map((mes) => {
    const inflacionMes = inflacion[mes] ?? null;
    const actual = precios.get(mes);
    const anterior = precios.get(mesAnteriorKey(mes));
    const variacion = actual != null && anterior != null && anterior > 0 ? ((actual - anterior) / anterior) * 100 : null;
    const diferencia = variacion != null && inflacionMes != null ? variacion - inflacionMes : null;
    return { mesKey: mes, inflacion: inflacionMes, variacion, diferencia };
  });

  const vars = puntos.map((p) => p.variacion).filter((v): v is number => v != null);
  const inflas = puntos.map((p) => p.inflacion).filter((v): v is number => v != null);
  const hayPrecios = vars.length > 0 || [...precios.keys()].some((k) => meses.includes(k));

  const inflacionAcumuladaPct = inflas.length > 0 ? acumularPct(inflas) * 100 : null;
  const mesesConPrecio = meses.filter((m) => {
    const v = precios.get(m);
    return v != null && v > 0;
  });
  let variacionPreciosPct: number | null = null;
  if (mesesConPrecio.length >= 2) {
    const primero = precios.get(mesesConPrecio[0]) ?? 0;
    const ultimo = precios.get(mesesConPrecio[mesesConPrecio.length - 1]) ?? 0;
    if (primero > 0) variacionPreciosPct = ((ultimo - primero) / primero) * 100;
  }
  const diferenciaPct = variacionPreciosPct != null && inflacionAcumuladaPct != null ? variacionPreciosPct - inflacionAcumuladaPct : null;
  const valorRealDe100 =
    variacionPreciosPct != null && inflacionAcumuladaPct != null
      ? (100 * (1 + variacionPreciosPct / 100)) / (1 + inflacionAcumuladaPct / 100)
      : null;

  let insight: InsightInflacion = 'sin_datos';
  if (hayPrecios && diferenciaPct != null) {
    insight = diferenciaPct < 0 ? 'menos' : 'mas';
  } else if (hayPrecios && inflas.length > 0) {
    insight = acumularPct(vars) < acumularPct(inflas) ? 'menos' : 'mas';
  }

  return {
    puntos,
    hayPrecios,
    insight,
    errorInflacion: null,
    desde,
    hasta,
    resumen: { inflacionAcumuladaPct, variacionPreciosPct, diferenciaPct, valorRealDe100 },
  };
}

export { MSG_SIN_INFLACION };
