export interface VarianteRecord {
  id: string;
  productoId: string;
  empresaId: string;
  sku: string | null;
  atributos: Record<string, string>;
  precioVenta: number | null;
  costo: number | null;
  activo: boolean;
  /** Solo en el listado: stock actual de la variante. */
  stock?: number;
}

export interface GuardarVarianteInput {
  id?: string;
  sku: string | null;
  atributos: Record<string, string>;
  precioVenta: number | null;
  costo: number | null;
  activo: boolean;
}

export interface RepartoStock {
  atributos: Record<string, string>;
  cantidad: number;
}

/** El producto tiene stock sin variante y hay que decir a qué variantes va (o el reparto no cierra). */
export class RepartoStockError extends Error {
  constructor(
    public readonly motivo: 'reparto_requerido' | 'reparto_no_suma' | 'reparto_variante_invalida' | 'stock_negativo',
    public readonly stockSinVariante: number,
  ) {
    super(motivo);
  }
}

/** Un SKU cargado a mano ya lo usa otro producto o variante. */
export class SkuDuplicadoError extends Error {
  constructor(
    public readonly sku: string,
    public readonly duplicadoDe: string,
  ) {
    super('SKU duplicado');
  }
}

/** Se lanza (y revierte la transacción) al querer apagar variantes que todavía tienen stock. */
export class VarianteConStockError extends Error {
  constructor(public readonly conStock: { etiqueta: string; stock: number }[]) {
    super('Variantes con stock');
  }
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
    opciones: { usuarioId: string; reparto?: RepartoStock[] },
  ): Promise<VarianteRecord[] | null>;
  /** Unidades del producto que no están en ninguna variante (stock "suelto"). */
  stockSinVariante(empresaId: string, productoId: string): Promise<number | null>;
}
