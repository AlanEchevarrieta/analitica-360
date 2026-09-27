// Espejo de ProductoListado / ListaProductos (apps/api modules/productos/productos.repository.ts).
export interface ProductoFila {
  id: string;
  nombre: string;
  categoriaNombre: string | null;
  codigoBarra: string | null;
  /** SKU del producto (los que tienen variantes lo tienen en cada variante). */
  sku: string | null;
  usaVariantes: boolean;
  /** Insumo / materia prima (no se vende tal cual). */
  esInsumo: boolean;
  unidad: string;
  /** Kit que se arma al vender: su stock es cuántos se pueden armar. */
  esKit: boolean;
  precioVenta: number | null;
  costo: number | null;
  activo: boolean;
  stock: number;
  /** Unidades vendidas en los últimos 90 días. */
  vendidos: number;
}

export interface ListaProductos {
  items: ProductoFila[];
  total: number;
  activos: number;
}

export type OrdenProductos = "demanda" | "nombre";

export type EstadoProducto = "todos" | "activos" | "inactivos";

export interface FiltrosProductos {
  pagina: number;
  pageSize: number;
  busqueda: string;
  estado: EstadoProducto;
  orden: OrdenProductos;
  /** venta = sin insumos (Nueva venta, pedidos); insumos = solo materias primas. */
  tipo?: "todos" | "venta" | "insumos";
}

/** GET /productos/:id/variantes (VarianteRecord). */
export interface VarianteProducto {
  id: string;
  sku: string | null;
  atributos: Record<string, string>;
  precioVenta: number | null;
  costo: number | null;
  activo: boolean;
}

/** Línea de un comprobante (venta o compra) armado con el buscador de productos. */
export interface LineaProducto {
  /** productoId + varianteId: una línea por combinación. */
  clave: string;
  productoId: string;
  varianteId: string | null;
  nombre: string;
  variante: string | null;
  /** Precio de venta o costo de compra, según el comprobante. */
  precioUnitario: number;
  cantidad: number;
  /** Stock del producto al momento de agregarlo. */
  stock: number;
  /** Unidad de medida (kg, m…) del producto. */
  unidad?: string;
}

export function etiquetaVariante(atributos: Record<string, string>) {
  return Object.values(atributos).filter(Boolean).join(" / ");
}
