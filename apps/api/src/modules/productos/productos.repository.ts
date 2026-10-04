export interface ProductoRecord {
  id: string;
  empresaId: string;
  nombre: string;
  categoriaId: string | null;
  categoriaNombre: string | null;
  codigoBarra: string | null;
  /** Código interno (productos sin variantes; con variantes, cada variante tiene el suyo). */
  sku: string | null;
  usaVariantes: boolean;
  esInsumo: boolean;
  unidad: string;
  enTienda: boolean;
  /** Oferta de la tienda online (null = sin oferta). */
  oferta: { tipo: 'porcentaje' | 'precio'; valor: number; desde: string | null; hasta: string | null } | null;
  precioVenta: number | null;
  costo: number | null;
  activo: boolean;
  altoCm: number | null;
  largoCm: number | null;
  anchoCm: number | null;
  pesoGr: number | null;
}

export interface GuardarProductoInput {
  nombre: string;
  /** Al editar, undefined = no cambia; null = se borra. */
  categoriaId?: string | null;
  precioVenta?: number | null;
  costo?: number | null;
  activo?: boolean;
  esInsumo?: boolean;
  unidad?: string;
  enTienda?: boolean;
}

export interface ProductosFiltro {
  busqueda: string;
  categoriaId: string | null;
  estado: 'todos' | 'activos' | 'inactivos';
  margen: 'todos' | 'alto' | 'medio' | 'bajo';
  orden: 'nombre' | 'demanda';
  tipo?: 'todos' | 'venta' | 'insumos';
  pagina: number;
  pageSize: number;
}

/** Fila del listado: el producto más su stock actual (SUM(cantidad*signo) de MovimientoInventario, mismo criterio que el dashboard). */
export interface ProductoListado extends ProductoRecord {
  stock: number;
  /** Unidades vendidas en los últimos 90 días (sin anuladas). */
  vendidos: number;
  /** Kit que se arma al vender (no tiene stock propio). */
  esKit: boolean;
}

export interface ListaProductos {
  items: ProductoListado[];
  total: number;
  activos: number;
}

export interface DimensionesProducto {
  altoCm: number | null;
  largoCm: number | null;
  anchoCm: number | null;
  pesoGr: number | null;
}

export const PRODUCTOS_REPOSITORY = Symbol('PRODUCTOS_REPOSITORY');

export type ResultadoGuardarProducto =
  | { ok: true; producto: ProductoRecord }
  | { ok: false; motivo: 'producto_no_encontrado' | 'categoria_invalida' };

/**
 * Puerto de persistencia de Producto. Implementación real:
 * PrismaProductosRepository. El stock NO vive acá - Producto no tiene columna
 * de stock (se deriva de MovimientoInventario, ver InventarioModule, todavía
 * sin implementar) - ver riesgo "stock derivado" en el plan de reescritura.
 */
export interface ProductosRepository {
  /**
   * `categoria_invalida` si `categoriaId` viene seteado y no es una
   * Categoria de esta empresa (aislamiento multi-tenant - ver riesgo en
   * el plan).
   */
  crear(empresaId: string, input: GuardarProductoInput): Promise<ResultadoGuardarProducto>;
  /** Actualiza y, si cambia precioVenta/costo, agrega un registro a PrecioHistorial (transaccional). */
  actualizar(empresaId: string, id: string, input: GuardarProductoInput): Promise<ResultadoGuardarProducto>;
  buscarPorId(empresaId: string, id: string): Promise<ProductoRecord | null>;
  listar(empresaId: string, filtro: ProductosFiltro): Promise<ListaProductos>;
  listarNombres(empresaId: string): Promise<{ id: string; nombre: string }[]>;
  /** null = producto inexistente; duplicadoDe = otro producto ya usa ese código. */
  guardarCodigoBarra(
    empresaId: string,
    id: string,
    codigoBarra: string | null,
  ): Promise<ProductoRecord | null | { duplicadoDe: string }>;
  guardarDimensiones(
    empresaId: string,
    id: string,
    dimensiones: DimensionesProducto,
  ): Promise<ProductoRecord | null>;
}
