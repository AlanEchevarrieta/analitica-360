/** Actualización masiva de precios: cálculo puro del precio nuevo. */

export type ModoAumento = 'porcentaje' | 'margen';

export interface ReglaAumento {
  modo: ModoAumento;
  /** porcentaje: +8 = subir 8% (negativo = bajar). margen: 50 = que la ganancia sea el 50% del precio. */
  valor: number;
  /** Redondear hacia arriba a este múltiplo (0 = sin redondeo). */
  redondeo: number;
}

/** Redondea hacia arriba al múltiplo (ej. 12.340 a $100 -> 12.400). */
export function redondearArriba(precio: number, multiplo: number): number {
  if (!(multiplo > 0)) return Math.round(precio * 100) / 100;
  return Math.ceil(Math.round(precio * 100) / 100 / multiplo) * multiplo;
}

/**
 * Precio nuevo según la regla, o null si no se puede calcular (sin precio
 * para un porcentaje, sin costo para llevar a un margen).
 */
export function precioNuevo(actual: number | null, costo: number | null, regla: ReglaAumento): number | null {
  let bruto: number | null = null;
  if (regla.modo === 'porcentaje') {
    if (actual == null || !(actual > 0)) return null;
    bruto = actual * (1 + regla.valor / 100);
  } else {
    if (costo == null || !(costo > 0) || !(regla.valor < 100)) return null;
    bruto = costo / (1 - regla.valor / 100);
  }
  return bruto > 0 ? redondearArriba(bruto, regla.redondeo) : null;
}

/** Margen de ganancia sobre el precio, en % (null sin costo). */
export function margenPct(precio: number | null, costo: number | null): number | null {
  if (precio == null || !(precio > 0) || costo == null) return null;
  return Math.round(((precio - costo) / precio) * 1000) / 10;
}
