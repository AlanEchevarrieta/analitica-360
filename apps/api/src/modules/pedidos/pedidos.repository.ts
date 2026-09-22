export const ESTADOS_PEDIDO = [
  'nuevo',
  'en_preparacion',
  'listo_despacho',
  'despachado',
  'con_transportista',
  'entregado',
  'cancelado',
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const ORIGENES_PEDIDO = ['manual', 'tienda_online', 'importacion'] as const;
export type OrigenPedido = (typeof ORIGENES_PEDIDO)[number];

export interface PedidoItemRecord {
  id: string;
  productoId: string;
  varianteId: string | null;
  loteId: string | null;
  productoNombre: string;
  codigoBarra: string | null;
  sku: string | null;
  varianteEtiqueta: string | null;
  numeroLote: string | null;
  cantidad: number;
  precioUnitario: number;
  cantidadPreparada: number;
  preparado: boolean;
}

export interface PedidoRecord {
  id: string;
  empresaId: string;
  numeroPedido: string;
  clienteId: string | null;
  clienteNombre: string | null;
  origen: OrigenPedido;
  estado: EstadoPedido;
  asignadoAId: string | null;
  total: number;
  createdAt: Date;
}

export interface PedidoFicha extends PedidoRecord {
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
  items: PedidoItemRecord[];
}

export interface ItemPedidoInput {
  productoId: string;
  varianteId?: string | null;
  loteId?: string | null;
  cantidad: number;
  precioUnitario: number;
}

export interface CrearPedidoInput {
  clienteId?: string | null;
  clienteNombre: string | null;
  clienteEmail: string | null;
  clienteTelefono: string | null;
  direccionEnvio: string | null;
  codigoPostal: string | null;
  localidad: string | null;
  provincia: string | null;
  metodoEnvio: string | null;
  notas: string | null;
  items: ItemPedidoInput[];
}

export type MotivoRechazoPedido = 'sin_items' | 'producto_invalido' | 'variante_invalida' | 'cliente_invalido';
export type ResultadoCrearPedido = { ok: true; pedido: PedidoFicha } | { ok: false; motivo: MotivoRechazoPedido };

export type ResultadoAsignar = 'ok' | 'no_encontrado' | 'usuario_invalido';
export type ResultadoItem = 'ok' | 'no_encontrado';
export type ResultadoListoDespacho = { ok: true; pedido: PedidoFicha } | { ok: false; motivo: 'no_encontrado' | 'incompleto' };
export type ResultadoDespacho =
  | { ok: true; pedido: PedidoFicha }
  | { ok: false; motivo: 'no_encontrado' | 'no_listo_despacho' | 'ubicacion_invalida' };
export type ResultadoTransicion = 'ok' | 'no_encontrado' | 'estado_invalido';

export interface FiltrosPedidos {
  pagina: number;
  pageSize: number;
  estado: EstadoPedido | '';
  origen: OrigenPedido | '';
  asignadoA?: string | null;
}

export interface ListaPedidos {
  items: PedidoRecord[];
  total: number;
}

export const PEDIDOS_REPOSITORY = Symbol('PEDIDOS_REPOSITORY');

/**
 * Puerto de persistencia de Pedido. Implementación real:
 * PrismaPedidosRepository. crear() valida producto/variante/cliente contra
 * la empresa y resuelve la asignación automática (ConfiguracionEmpresa.
 * modoAsignacion) al crear. El stock se descuenta recién en
 * registrarDespacho() (tipo 'pedido', signo -1) - hasta ahí un pedido no
 * mueve inventario, solo lo "reserva" visualmente en el picking.
 */
export interface PedidosRepository {
  listar(empresaId: string, filtro: FiltrosPedidos): Promise<ListaPedidos>;
  ficha(empresaId: string, id: string): Promise<PedidoFicha | null>;
  crear(empresaId: string, input: CrearPedidoInput): Promise<ResultadoCrearPedido>;
  asignar(empresaId: string, id: string, usuarioId: string | null): Promise<ResultadoAsignar>;
  /** Guarda el avance de un item y resincroniza el estado del pedido (nuevo/en_preparacion/listo_despacho) según el agregado. */
  guardarPreparacionItem(
    empresaId: string,
    id: string,
    itemId: string,
    cantidadPreparada: number,
    preparado: boolean,
  ): Promise<ResultadoItem>;
  marcarTodoPreparado(empresaId: string, id: string): Promise<ResultadoItem>;
  confirmarListoDespacho(empresaId: string, id: string): Promise<ResultadoListoDespacho>;
  registrarDespacho(
    empresaId: string,
    usuarioId: string,
    id: string,
    transportista: string | null,
    numeroSeguimiento: string | null,
    ubicacionOrigen: string | null,
  ): Promise<ResultadoDespacho>;
  marcarConTransportista(empresaId: string, id: string): Promise<ResultadoTransicion>;
  marcarEntregado(empresaId: string, id: string): Promise<ResultadoTransicion>;
  /** Solo permitido antes del despacho (no movió stock todavía). */
  cancelar(empresaId: string, id: string): Promise<ResultadoTransicion>;
  colaboradoresActivos(empresaId: string): Promise<{ id: string; nombre: string }[]>;
}
