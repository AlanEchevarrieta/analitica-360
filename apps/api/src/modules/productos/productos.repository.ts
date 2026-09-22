export interface ProductoRecord {
  id: string;
  empresaId: string;
  nombre: string;
  categoriaId: string | null;
  categoriaNombre: string | null;
  codigoBarra: string | null;
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
  categoriaId: string | null;
  precioVenta: number | null;
  costo: number | null;
  activo: boolean;
}

export interface ProductosFiltro {
  busqueda: string;
  categoriaId: string | null;
  estado: 'todos' | 'activos' | 'inactivos';
  margen: 'todos' | 'alto' | 'medio' | 'bajo';
  pagina: number;
  pageSize: number;
}

export interface ListaProductos {
  items: ProductoRecord[];
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

/**
 * Puerto de persistencia de Producto. Implementación real:
 * PrismaProductosRepository. El stock NO vive acá - Producto no tiene columna
 * de stock (se deriva de MovimientoInventario, ver InventarioModule, todavía
 * sin implementar) - ver riesgo "stock derivado" en el plan de reescritura.
 */
export interface ProductosRepository {
  crear(empresaId: string, input: GuardarProductoInput): Promise<ProductoRecord>;
  /** Actualiza y, si cambia precioVenta/costo, agrega un registro a PrecioHistorial (transaccional). */
  actualizar(empresaId: string, id: string, input: GuardarProductoInput): Promise<ProductoRecord | null>;
  buscarPorId(empresaId: string, id: string): Promise<ProductoRecord | null>;
  listar(empresaId: string, filtro: ProductosFiltro): Promise<ListaProductos>;
  listarNombres(empresaId: string): Promise<{ id: string; nombre: string }[]>;
  guardarCodigoBarra(empresaId: string, id: string, codigoBarra: string | null): Promise<ProductoRecord | null>;
  guardarDimensiones(
    empresaId: string,
    id: string,
    dimensiones: DimensionesProducto,
  ): Promise<ProductoRecord | null>;
}
