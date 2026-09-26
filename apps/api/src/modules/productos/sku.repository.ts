export const SKU_REPOSITORY = Symbol('SKU_REPOSITORY');

export interface CodigoEncontrado {
  productoId: string;
  varianteId: string | null;
}

/** SKU únicos por empresa, compartidos entre productos (sin variantes) y variantes. */
export interface SkuRepository {
  /**
   * Genera el SKU de lo que no tenga: productos sin variantes y variantes
   * activas o no (de un producto, o de toda la empresa). Devuelve cuántos asignó.
   */
  asignarFaltantes(empresaId: string, productoId?: string): Promise<number>;
  /** Quién usa ese SKU (sin contar al que se está editando), o null si está libre. */
  enUso(empresaId: string, sku: string, excluir: { productoId?: string; varianteId?: string }): Promise<string | null>;
  /** Busca por código de barras o SKU (producto o variante), sin distinguir mayúsculas. */
  buscarPorCodigo(empresaId: string, codigo: string): Promise<CodigoEncontrado | null>;
  /** Cambia el SKU de un producto sin variantes (null = que lo genere el sistema). */
  guardarSkuProducto(empresaId: string, productoId: string, sku: string | null): Promise<'ok' | 'no_encontrado' | { duplicadoDe: string }>;
}
