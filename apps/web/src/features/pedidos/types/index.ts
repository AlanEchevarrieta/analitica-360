// Espejo de PedidoRecord / PedidoFicha (apps/api modules/pedidos/pedidos.repository.ts).
export type EstadoPedido =
  | "nuevo"
  | "en_preparacion"
  | "listo_despacho"
  | "despachado"
  | "con_transportista"
  | "entregado"
  | "cancelado";

export type OrigenPedido = "manual" | "tienda_online" | "importacion";

export interface PedidoFila {
  id: string;
  numeroPedido: string;
  clienteNombre: string | null;
  origen: OrigenPedido;
  estado: EstadoPedido;
  asignadoAId: string | null;
  total: number;
  createdAt: string;
}

export interface PedidoItem {
  id: string;
  productoNombre: string;
  codigoBarra: string | null;
  sku: string | null;
  varianteEtiqueta: string | null;
  cantidad: number;
  precioUnitario: number;
  cantidadPreparada: number;
  preparado: boolean;
}

export interface PedidoDetalle extends PedidoFila {
  /** Descuentos de la tienda online: el total del pedido ya los tiene restados. */
  descuentos: { subtotal: number; ofertas: number; cuponCodigo: string | null; cupon: number; transferencia: number; formaPagoTienda: string | null };
  clienteEmail: string | null;
  clienteTelefono: string | null;
  direccionEnvio: string | null;
  codigoPostal: string | null;
  localidad: string | null;
  provincia: string | null;
  metodoEnvio: string | null;
  numeroSeguimiento: string | null;
  transportista: string | null;
  notas: string | null;
  ventaId: string | null;
  items: PedidoItem[];
}

export interface Remitente {
  nombre: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
}

export const ESTADOS: { valor: EstadoPedido; etiqueta: string; color: string }[] = [
  { valor: "nuevo", etiqueta: "Nuevo", color: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  { valor: "en_preparacion", etiqueta: "En preparación", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { valor: "listo_despacho", etiqueta: "Listo para despachar", color: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { valor: "despachado", etiqueta: "Despachado", color: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  { valor: "con_transportista", etiqueta: "Con transportista", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { valor: "entregado", etiqueta: "Entregado", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { valor: "cancelado", etiqueta: "Cancelado", color: "bg-red-500/15 text-red-600 dark:text-red-400" },
];

export const ORIGENES: Record<OrigenPedido, string> = {
  manual: "Manual",
  tienda_online: "Tienda online",
  importacion: "Importación",
};

export function etiquetaItem(i: Pick<PedidoItem, "productoNombre" | "varianteEtiqueta">) {
  return i.varianteEtiqueta ? `${i.productoNombre} (${i.varianteEtiqueta})` : i.productoNombre;
}
