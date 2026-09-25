// Espejo de ProductoListado / ListaProductos (apps/api modules/productos/productos.repository.ts).
export interface ProductoFila {
  id: string;
  nombre: string;
  categoriaNombre: string | null;
  codigoBarra: string | null;
  precioVenta: number | null;
  costo: number | null;
  activo: boolean;
  stock: number;
}

export interface ListaProductos {
  items: ProductoFila[];
  total: number;
  activos: number;
}

export type EstadoProducto = "todos" | "activos" | "inactivos";

export interface FiltrosProductos {
  pagina: number;
  pageSize: number;
  busqueda: string;
  estado: EstadoProducto;
}
