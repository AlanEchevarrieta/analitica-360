import type { CuponTienda, Oferta } from './precios-tienda.util.js';

export interface VarianteCatalogo {
  id: string;
  sku: string | null;
  atributos: Record<string, string>;
  /** Precio final (con la oferta del producto si está vigente). */
  precio: number;
  precioLista: number;
  stock: number;
}

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  categoria: string | null;
  categoriaId: string | null;
  /** Precio final (con la oferta si está vigente) y el de lista, para mostrarlo tachado. */
  precio: number;
  precioLista: number;
  /** % de descuento de la oferta (0 = sin oferta) y su último día. */
  descuentoPct: number;
  ofertaHasta: string | null;
  stock: number;
  vendidos: number;
  /** Alta del producto (para ordenar por novedades). */
  creadoEn: string;
  /** Fotos en orden (la primera es la principal). */
  imagenes: string[];
  /** Las mismas fotos en tamaño chico, para listados. */
  miniaturas: string[];
  variantes: VarianteCatalogo[];
}

/** Producto que se puede pedir desde la tienda, con sus precios vigentes. */
export interface ProductoVendible {
  id: string;
  /** Precio de lista (sin oferta): la oferta la aplica el servicio con la fecha de hoy. */
  precio: number;
  oferta: Oferta | null;
  variantes: { id: string; precio: number }[];
}

/** El catálogo como lo guarda la base: precios de lista y la oferta, sin aplicar. */
export type ProductoCatalogoBase = Omit<ProductoCatalogo, 'precioLista' | 'descuentoPct' | 'ofertaHasta' | 'variantes'> & {
  oferta: Oferta | null;
  variantes: Omit<VarianteCatalogo, 'precioLista'>[];
};

export interface CondicionesTienda {
  pedidoMinimo: number | null;
  /** % de descuento por pagar con transferencia (0 = no hay). */
  descuentoTransferencia: number;
}

export const TIENDA_REPOSITORY = Symbol('TIENDA_REPOSITORY');

/**
 * Lectura pública del catálogo de una empresa. Reemplaza las RPC
 * catalogo_tienda / crear_pedido_tienda del legacy en Supabase.
 * Solo expone productos y variantes activos y no borrados.
 */
export interface TiendaRepository {
  empresaActiva(empresaId: string): Promise<boolean>;
  /** Monto mínimo de compra configurado (null = sin mínimo). */
  pedidoMinimo(empresaId: string): Promise<number | null>;
  condiciones(empresaId: string): Promise<CondicionesTienda>;
  catalogo(empresaId: string): Promise<ProductoCatalogoBase[]>;
  cupon(empresaId: string, codigo: string): Promise<CuponTienda | null>;
  /** Suma un uso solo si no se pasa del límite (atómico). false = ya está agotado. */
  usarCupon(empresaId: string, codigo: string): Promise<boolean>;
  devolverCupon(empresaId: string, codigo: string): Promise<void>;
  productosVendibles(empresaId: string, productoIds: string[]): Promise<ProductoVendible[]>;
}
