export interface VarianteCatalogo {
  id: string;
  sku: string | null;
  atributos: Record<string, string>;
  precio: number;
  stock: number;
}

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  categoria: string | null;
  categoriaId: string | null;
  precio: number;
  stock: number;
  vendidos: number;
  /** Fotos en orden (la primera es la principal). */
  imagenes: string[];
  variantes: VarianteCatalogo[];
}

/** Producto que se puede pedir desde la tienda, con sus precios vigentes. */
export interface ProductoVendible {
  id: string;
  precio: number;
  variantes: { id: string; precio: number }[];
}

export const TIENDA_REPOSITORY = Symbol('TIENDA_REPOSITORY');

/**
 * Lectura pública del catálogo de una empresa. Reemplaza las RPC
 * catalogo_tienda / crear_pedido_tienda del legacy en Supabase.
 * Solo expone productos y variantes activos y no borrados.
 */
export interface TiendaRepository {
  empresaActiva(empresaId: string): Promise<boolean>;
  catalogo(empresaId: string): Promise<ProductoCatalogo[]>;
  productosVendibles(empresaId: string, productoIds: string[]): Promise<ProductoVendible[]>;
}
