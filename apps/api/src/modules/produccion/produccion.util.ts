/** Producción: cálculos puros (costo de una receta, necesidades de una orden, kits). */

export const UNIDADES = ['unidad', 'kg', 'g', 'l', 'ml', 'm', 'cm'] as const;
export type Unidad = (typeof UNIDADES)[number];

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ComponenteCosteado {
  insumoId: string;
  insumoVarianteId: string | null;
  /** Por unidad fabricada. */
  cantidad: number;
  /** Costo actual (PPP) del insumo por su unidad. */
  costoUnitario: number | null;
}

export interface CostoReceta {
  /** Materiales por unidad (lo que va al valor del stock). */
  materiales: number;
  /** Mano de obra por unidad (minutos × valor hora; solo para precios). */
  manoObra: number;
  total: number;
  /** Insumos sin costo cargado: el costo real va a ser mayor. */
  sinCosto: number;
}

export function costoReceta(componentes: ComponenteCosteado[], minutos: number, valorHora: number | null): CostoReceta {
  const materiales = componentes.reduce((a, c) => a + c.cantidad * (c.costoUnitario ?? 0), 0);
  const manoObra = valorHora ? (minutos / 60) * valorHora : 0;
  return {
    materiales: r2(materiales),
    manoObra: r2(manoObra),
    total: r2(materiales + manoObra),
    sinCosto: componentes.filter((c) => !c.costoUnitario || c.costoUnitario <= 0).length,
  };
}

/** Margen sobre el precio de venta, en %. */
export function margenFabricacion(precio: number | null, costo: number): number | null {
  if (!precio || precio <= 0) return null;
  return Math.round(((precio - costo) / precio) * 1000) / 10;
}

export interface Necesidad {
  insumoId: string;
  insumoVarianteId: string | null;
  necesita: number;
  stock: number;
  falta: number;
}

const clave = (id: string, variante: string | null) => `${id}:${variante ?? ''}`;

/**
 * Cuánto de cada insumo hace falta para fabricar `cantidad` unidades y cuánto
 * falta según el stock. Mismo insumo repetido en la receta = se suma.
 * Las cantidades se redondean a 2 decimales (como los movimientos de stock).
 */
export function necesidades(componentes: { insumoId: string; insumoVarianteId: string | null; cantidad: number }[], cantidad: number, stock: Map<string, number>): Necesidad[] {
  const porInsumo = new Map<string, Necesidad>();
  for (const c of componentes) {
    const k = clave(c.insumoId, c.insumoVarianteId);
    const previa = porInsumo.get(k);
    const necesita = (previa?.necesita ?? 0) + c.cantidad * cantidad;
    porInsumo.set(k, { insumoId: c.insumoId, insumoVarianteId: c.insumoVarianteId, necesita, stock: stock.get(k) ?? 0, falta: 0 });
  }
  return [...porInsumo.values()].map((n) => {
    const necesita = r2(n.necesita);
    return { ...n, necesita, falta: r2(Math.max(0, necesita - Math.max(0, n.stock))) };
  });
}

export { clave as claveInsumo };

export interface ItemSalida {
  productoId: string;
  varianteId: string | null;
  cantidad: number;
}

export interface KitReceta {
  productoId: string;
  varianteId: string | null;
  componentes: { insumoId: string; insumoVarianteId: string | null; cantidad: number }[];
}

/**
 * Items de una venta/devolución con los kits "que se arman al vender"
 * reemplazados por sus componentes. Devuelve, por cada item original, qué
 * movimientos de stock genera (el mismo item si no es kit).
 */
export function expandirKits(items: ItemSalida[], kits: KitReceta[]): { original: ItemSalida; salidas: ItemSalida[]; esKit: boolean }[] {
  const porClave = new Map(kits.map((k) => [clave(k.productoId, k.varianteId), k]));
  return items.map((item) => {
    // Receta de la variante exacta; si no hay, la del producto (sirve para todas sus variantes).
    const kit = porClave.get(clave(item.productoId, item.varianteId)) ?? porClave.get(clave(item.productoId, null));
    if (!kit || kit.componentes.length === 0) return { original: item, salidas: [item], esKit: false };
    return {
      original: item,
      esKit: true,
      salidas: kit.componentes.map((c) => ({ productoId: c.insumoId, varianteId: c.insumoVarianteId, cantidad: r2(c.cantidad * item.cantidad) })),
    };
  });
}
