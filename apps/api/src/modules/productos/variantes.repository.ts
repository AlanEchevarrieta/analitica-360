export interface VarianteRecord {
  id: string;
  productoId: string;
  empresaId: string;
  sku: string | null;
  atributos: Record<string, string>;
  precioVenta: number | null;
  costo: number | null;
  activo: boolean;
}

export interface GuardarVarianteInput {
  id?: string;
  sku: string | null;
  atributos: Record<string, string>;
  precioVenta: number | null;
  costo: number | null;
  activo: boolean;
}

export const VARIANTES_REPOSITORY = Symbol('VARIANTES_REPOSITORY');

/**
 * Puerto de persistencia de ProductoVariante. Implementación real:
 * PrismaVariantesRepository. `null` en los métodos significa "el producto
 * no existe o no pertenece a esta empresa" (tenant scoping).
 */
export interface VariantesRepository {
  listarPorProducto(empresaId: string, productoId: string): Promise<VarianteRecord[] | null>;
  /**
   * Upsert por id (si viene) o por combinación de atributos; las que no
   * vienen en la lista se desactivan, nunca se borran (deletedAt no se
   * toca acá - mismo comportamiento que guardarVariantesProducto del
   * legacy). Además recalcula Producto.usaVariantes/costo/precioVenta como
   * promedio ponderado de las variantes activas y, si quedan definidos,
   * agrega un registro a PrecioHistorial - todo en una transacción.
   */
  guardarVariantesProducto(
    empresaId: string,
    productoId: string,
    variantes: GuardarVarianteInput[],
  ): Promise<VarianteRecord[] | null>;
}
