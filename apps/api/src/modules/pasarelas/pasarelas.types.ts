export type ProveedorPasarela = 'mercadopago' | 'uala' | 'stripe';

export type OrigenCobroTipo =
  | 'pedido_tienda'
  | 'venta_pos'
  | 'cobro_cuenta_corriente'
  | 'reserva_turno'
  | 'abono'
  | 'link_rapido';

export type EstadoTransaccion = 'pendiente' | 'aprobado' | 'rechazado' | 'expirado' | 'reembolsado';

export interface CrearCobroInput {
  monto: number;
  moneda?: string; // 'ARS' | 'USD'
  concepto: string;
  clienteNombre?: string;
  clienteEmail?: string;
  origenTipo: OrigenCobroTipo;
  origenId?: string;
  metadata?: Record<string, unknown>;
  expiraMinutos?: number;
  urlVuelta?: string;
  negocioSlug?: string;
}

export interface CobroGeneradoResult {
  idExterno: string;
  urlPago: string;
  qrData?: string | null;
  estado: EstadoTransaccion;
  comisionEstimada: number;
  montoNeto?: number;
  metadata?: Record<string, unknown>;
}

export interface WebhookEventoResult {
  reconocido: boolean;
  idExterno?: string;
  proveedor: ProveedorPasarela;
  estadoNuevo?: EstadoTransaccion;
  montoPagado?: number;
  pagadoEn?: Date;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface DetallePagoResult {
  idExterno: string;
  estado: EstadoTransaccion;
  monto: number;
  pagadoEn?: Date | null;
  comision?: number;
}
