/**
 * SKU automático: CATEGORIA-PRODUCTO[-VARIANTE]-NNN, en mayúsculas y sin
 * tildes. Ej. "Mate Imperial" (Mates), color Negro -> MAT-MATIMP-NEG-001.
 * El número final garantiza que no se repita dentro de la empresa.
 */

const PALABRAS_VACIAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS', 'CON', 'Y', 'E', 'PARA', 'POR', 'EN', 'UN', 'UNA', 'AL']);

/** Palabras en mayúsculas, sin tildes ni símbolos. */
function palabras(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** Primeras 3 letras de hasta `cuantas` palabras significativas. */
export function codigoDe(texto: string | null | undefined, cuantas: number): string {
  const todas = palabras(texto ?? '');
  const utiles = todas.filter((p) => !PALABRAS_VACIAS.has(p));
  return (utiles.length ? utiles : todas)
    .slice(0, cuantas)
    .map((p) => p.slice(0, 3))
    .join('');
}

export interface DatosSku {
  categoria: string | null;
  producto: string;
  /** Valores de la variante en orden (ej. ["Negro", "Grande"]); vacío si es un producto sin variantes. */
  valores?: string[];
}

/** Base sin número: MAT-MATIMP-NEG. */
export function baseSku(d: DatosSku): string {
  const partes = [codigoDe(d.categoria, 1) || 'GEN', codigoDe(d.producto, 2) || 'PROD'];
  const variante = (d.valores ?? []).map((v) => codigoDe(v, 1)).filter(Boolean).join('');
  if (variante) partes.push(variante);
  return partes.join('-');
}

/**
 * SKU libre para `d`, que no esté en `usados` (en mayúsculas). Agrega el
 * elegido a `usados` para poder generar varios seguidos sin choques.
 */
export function generarSku(d: DatosSku, usados: Set<string>): string {
  const base = baseSku(d);
  for (let n = 1; ; n++) {
    const sku = `${base}-${String(n).padStart(3, '0')}`;
    if (!usados.has(sku)) {
      usados.add(sku);
      return sku;
    }
  }
}

/** SKU cargado a mano: sin espacios de más y en mayúsculas (así se compara siempre igual). */
export function normalizarSku(sku: string | null | undefined): string | null {
  const limpio = (sku ?? '').trim().replace(/\s+/g, '-').toUpperCase();
  return limpio || null;
}
