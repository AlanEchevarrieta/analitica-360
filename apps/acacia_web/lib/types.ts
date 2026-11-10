export interface SitioConfig {
  empresaId: string;
  subdominio: string;
  nombre: string;
  descripcion: string;
  color: string;
  logoUrl: string | null;
  whatsapp: string | null;
  instagram: string | null;
  textoEnvios: string | null;
  alias: string | null;
  cbu: string | null;
  titular: string | null;
  pedidoMinimo: number | null;
  descuentoTransferencia: number;
}

export interface VarianteProducto {
  id: string;
  sku: string;
  atributos: Record<string, string>;
  precio: number;
  precioLista: number;
  activo: boolean;
  stock: number;
}

export interface ProductoDetalles {
  material: string;
  virola?: string;
  origen: string;
  curado: string;
  capacidadAprox?: string;
  pesoGramos?: number;
}

export interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  categoriaSlug: string;
  precio: number;
  precioLista: number;
  descuentoPct: number;
  imagenes: string[];
  miniaturas: string[];
  stock: number;
  vendidos: number;
  slug: string;
  descripcion: string;
  detalles: ProductoDetalles;
  variantes: VarianteProducto[];
}

export interface ItemCarrito {
  productoId: string;
  varianteId: string | null;
  nombre: string;
  varianteEtiqueta?: string;
  precio: number;
  cantidad: number;
  slug: string;
  imagen: string;
}

export interface DatosEnvio {
  nombre: string;
  email: string;
  telefono: string;
  calle: string;
  numero: string;
  piso?: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  notas?: string;
}

export type MetodoPago = "transferencia" | "mercadopago" | "a_coordinar";

export interface CrearPedidoRequest {
  empresaId: string;
  datosEnvio: DatosEnvio;
  metodoPago: MetodoPago;
  items: {
    productoId: string;
    varianteId: string | null;
    cantidad: number;
    precioUnitario: number;
    nombre: string;
  }[];
  cuponCodigo?: string;
  costoEnvio?: number;
}

export interface ResultadoPedido {
  ok: boolean;
  numeroPedido?: string;
  pedidoId?: string;
  total?: number;
  descuentoTransferencia?: number;
  pagoUrl?: string | null;
  error?: string;
}
