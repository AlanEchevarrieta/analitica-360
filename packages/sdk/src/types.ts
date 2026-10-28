/**
 * Tipos y contratos de datos oficiales de Analítica 360
 */

// ==========================================
// MÓDULO DE AGENDA Y TURNOS ONLINE
// ==========================================

export interface TurnoServicio {
  id: string;
  nombre: string;
  duracionMin: number;
  precio: number | null;
  modoPrecio: 'fijo' | 'a_convenir' | 'desde' | string;
}

export interface TurnoProfesional {
  id: string;
  nombre: string;
  color: string | null;
}

export interface AgendaOpcionesActiva {
  activa: true;
  diasMaximo: number;
  mensaje: string | null;
  hoy: string;
  servicios: TurnoServicio[];
  profesionales: TurnoProfesional[];
}

export interface AgendaOpcionesInactiva {
  activa: false;
}

export type AgendaOpcionesResponse = AgendaOpcionesActiva | AgendaOpcionesInactiva;

export interface TurnosLibresQuery {
  fecha: string; // formato YYYY-MM-DD
  servicioId: string;
  recursoId?: string | null;
}

export interface HorarioLibre {
  hora: string; // HH:mm
  profesionales: string[]; // IDs de profesionales disponibles
}

export interface TurnosLibresResponse {
  fecha: string;
  duracionMin: number;
  libres: HorarioLibre[];
}

export interface ReservaOnlineInput {
  servicioId: string;
  /** ID del profesional o null / undefined para asignar cualquiera disponible */
  recursoId?: string | null;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  nombre: string;
  telefono: string;
  notas?: string | null;
}

export interface TurnoReservadoResult {
  id: string;
  servicio: string;
  profesional: string;
  inicio: string | Date;
  fin: string | Date;
  cuando: string;
  mensaje: string | null;
  /** Token firmado para cancelar o consultar el turno sin autenticación */
  cancelar: string;
}

export interface TurnoDetalle {
  profesional: string;
  servicio: string | null;
  cliente: string | null;
  cuando: string;
  estado: 'reservado' | 'confirmado' | 'cancelado' | 'atendido' | 'ausente' | string;
  cancelable: boolean;
}

// ==========================================
// MÓDULO DE CATÁLOGO Y E-COMMERCE
// ==========================================

export interface VarianteCatalogo {
  id: string;
  sku: string | null;
  atributos: Record<string, string>;
  precio: number;
  precioLista: number;
  stock: number;
}

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  categoria: string | null;
  categoriaId: string | null;
  precio: number;
  precioLista: number;
  descuentoPct: number;
  ofertaHasta: string | null;
  stock: number;
  vendidos: number;
  creadoEn: string;
  imagenes: string[];
  miniaturas: string[];
  variantes: VarianteCatalogo[];
}

export interface CondicionesTienda {
  pedidoMinimo: number | null;
  descuentoTransferencia: number;
  mercadoPago: boolean;
}

// ==========================================
// CUPONES, ENVÍOS Y PEDIDOS
// ==========================================

export interface DescuentoCupon {
  tipo: 'porcentaje' | 'monto';
  valor: number;
  montoDescontado: number;
}

export type ValidarCuponResult =
  | { valido: true; codigo: string; descuento: DescuentoCupon }
  | { valido: false; mensaje: string };

export interface ItemPedidoInput {
  productoId: string;
  varianteId?: string | null;
  cantidad: number;
}

export interface CotizarEnvioInput {
  codigoPostal: string;
  localidad: string;
  provincia: string;
  items: ItemPedidoInput[];
}

export interface OpcionEnvioCotizado {
  codigo: string;
  nombre: string;
  precio: number;
  plazoDias?: number;
}

export interface CrearPedidoInput {
  clienteNombre: string;
  clienteEmail: string;
  clienteTelefono: string;
  direccionEnvio: string;
  codigoPostal: string;
  localidad: string;
  provincia: string;
  notas?: string | null;
  items: ItemPedidoInput[];
  cuponCodigo?: string | null;
  formaPago: 'transferencia' | 'a_coordinar' | 'mercadopago';
  envio?: string | null;
}

export interface PedidoCreadoResult {
  id: string;
  numeroPedido: string;
  subtotal: number;
  descuentoCupon: number;
  descuentoTransferencia: number;
  costoEnvio: number;
  total: number;
  /** URL de checkout de pasarela de pago (Mercado Pago), o null si es transferencia / a coordinar */
  pagoUrl: string | null;
}

// ==========================================
// CONFIGURACIÓN DEL CLIENTE
// ==========================================

export interface Analitica360ClientOptions {
  /** UUID de la empresa en Analítica 360 */
  empresaId: string;
  /** URL base del backend API (por defecto https://api.analitica360.app o localhost:3001) */
  baseUrl?: string;
  /** Clave opcional de proxy de tienda si se ejecuta en backend server-to-server */
  tiendaKey?: string;
  /** IP del cliente final para rate-limiting cuando se ejecuta detrás de un proxy */
  clientIp?: string;
  /** Función fetch personalizada (ej. para tests o runtimes especiales) */
  fetch?: typeof fetch;
}
