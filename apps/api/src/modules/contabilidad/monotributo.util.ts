/**
 * Control del tope de facturación del monotributo: ingresos brutos de los
 * últimos 12 meses contra el tope de la categoría. Funciones puras.
 */

export const CATEGORIAS_MONOTRIBUTO = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'] as const;
export type CategoriaMonotributo = (typeof CATEGORIAS_MONOTRIBUTO)[number];

export interface TopeCategoria {
  categoria: CategoriaMonotributo;
  topeAnual: number;
}

export type AlertaMonotributo = 'exclusion' | 'supera_categoria' | 'cerca_tope' | 'puede_bajar' | 'sin_categoria' | 'topes_desactualizados';

export interface EstadoMonotributo {
  ingresos12m: number;
  /** Categoría que corresponde por los ingresos de los últimos 12 meses (null = supera la más alta). */
  categoriaSegunIngresos: CategoriaMonotributo | null;
  categoriaActual: CategoriaMonotributo | null;
  topeActual: number | null;
  /** Porcentaje del tope de la categoría actual ya facturado. */
  usoPct: number | null;
  /** Cuánto se puede facturar todavía sin pasarse de la categoría actual. */
  margenDisponible: number | null;
  /** Promedio mensual de los últimos 3 meses. */
  ritmoMensual: number;
  /** Ingresos anuales si se sigue al ritmo de los últimos 3 meses. */
  proyeccionAnual: number;
  categoriaProyectada: CategoriaMonotributo | null;
  /** Próxima recategorización (enero o julio) y el período de ingresos que se mira. */
  proximaRecategorizacion: { mes: string; desde: string; hasta: string };
  alertas: AlertaMonotributo[];
}

/** La categoría más baja cuyo tope cubre los ingresos (null si supera la más alta). */
export function categoriaPara(ingresos: number, topes: TopeCategoria[]): CategoriaMonotributo | null {
  const ordenados = [...topes].sort((a, b) => a.topeAnual - b.topeAnual);
  return ordenados.find((t) => ingresos <= t.topeAnual)?.categoria ?? null;
}

/** La recategorización es en enero y julio, mirando los 12 meses cerrados al 31/12 o al 30/6. */
export function proximaRecategorizacion(hoy: string): { mes: string; desde: string; hasta: string } {
  const [y, m] = hoy.split('-').map(Number);
  if (m <= 6) return { mes: `${y}-07`, desde: `${y - 1}-07-01`, hasta: `${y}-06-30` };
  return { mes: `${y + 1}-01`, desde: `${y}-01-01`, hasta: `${y}-12-31` };
}

export function estadoMonotributo(input: {
  ingresos12m: number;
  ingresosUltimos3Meses: number;
  categoriaActual: string | null;
  topes: TopeCategoria[];
  vigenciaTopes: string | null;
  hoy: string;
}): EstadoMonotributo {
  const { ingresos12m, topes, hoy } = input;
  const actual = (CATEGORIAS_MONOTRIBUTO as readonly string[]).includes(input.categoriaActual ?? '') ? (input.categoriaActual as CategoriaMonotributo) : null;
  const topeActual = actual ? (topes.find((t) => t.categoria === actual)?.topeAnual ?? null) : null;
  const categoriaSegunIngresos = categoriaPara(ingresos12m, topes);
  const ritmoMensual = input.ingresosUltimos3Meses / 3;
  const proyeccionAnual = ritmoMensual * 12;

  const alertas: AlertaMonotributo[] = [];
  if (!actual) alertas.push('sin_categoria');
  if (topes.length > 0 && categoriaSegunIngresos === null) alertas.push('exclusion');
  else if (topeActual != null && ingresos12m > topeActual) alertas.push('supera_categoria');
  else if (topeActual != null && ingresos12m >= topeActual * 0.8) alertas.push('cerca_tope');
  if (actual && categoriaSegunIngresos && CATEGORIAS_MONOTRIBUTO.indexOf(categoriaSegunIngresos) < CATEGORIAS_MONOTRIBUTO.indexOf(actual)) {
    alertas.push('puede_bajar');
  }
  // Los topes se actualizan cada 6 meses: más de 7 meses sin cargar nuevos = posiblemente viejos.
  if (!input.vigenciaTopes || (Date.parse(hoy) - Date.parse(input.vigenciaTopes)) / 86_400_000 > 213) alertas.push('topes_desactualizados');

  return {
    ingresos12m,
    categoriaSegunIngresos,
    categoriaActual: actual,
    topeActual,
    usoPct: topeActual ? Math.round((ingresos12m / topeActual) * 1000) / 10 : null,
    margenDisponible: topeActual != null ? Math.max(0, Math.round(topeActual - ingresos12m)) : null,
    ritmoMensual: Math.round(ritmoMensual),
    proyeccionAnual: Math.round(proyeccionAnual),
    categoriaProyectada: categoriaPara(proyeccionAnual, topes),
    proximaRecategorizacion: proximaRecategorizacion(hoy),
    alertas,
  };
}
