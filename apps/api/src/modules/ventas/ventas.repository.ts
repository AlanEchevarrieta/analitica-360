export type EstadoCobro = 'pagado' | 'señado' | 'saldo_pendiente';

export interface VentaRecord {
  id: string;
  empresaId: string;
  numeroVenta: string | null;
  fecha: Date;
  formaPago: string;
  descuento: number;
  clienteId: string | null;
  clienteNombre: string | null;
  cuotas: number;
  coeficienteInteres: number;
  totalSinInteres: number | null;
  totalConInteres: number | null;
  notas: string | null;
  anulada: boolean;
  esSenia: boolean;
  montoSenia: number;
  saldoPendiente: number;
  estadoCobro: EstadoCobro;
  fechaCobroSaldo: Date | null;
  /** Concatenado ("Yerba × 2, Mate × 1"), para la lista - igual que VentaFila del legacy. */
  productos: string;
  /** totalConInteres || totalSinInteres || suma de items - descuento. */
  total: number;
}

export interface VentaItemRecord {
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface VentaFicha extends VentaRecord {
  items: VentaItemRecord[];
}

export interface ItemVentaInput {
  productoId: string;
  varianteId?: string | null;
  loteId?: string | null;
  cantidad: number;
  precioUnitario: number;
}

export interface ConfirmarVentaInput {
  usuarioId: string;
  items: ItemVentaInput[];
  formaPago: string;
  descuento: number;
  clienteNombre: string | null;
  clienteId?: string | null;
  cuotas: number;
  coeficienteInteres: number;
  ubicacionOrigen?: string | null;
  esSenia: boolean;
  montoSenia: number;
}

export type MotivoRechazoVenta =
  | 'sin_productos'
  | 'producto_invalido'
  | 'variante_invalida'
  | 'cliente_invalido'
  | 'ubicacion_invalida'
  | 'senia_invalida';

export type ResultadoConfirmarVenta = { ok: true; venta: VentaRecord } | { ok: false; motivo: MotivoRechazoVenta };

export type ResultadoAnularVenta = 'ok' | 'no_encontrada' | 'ya_anulada';

export type ResultadoCobrarSaldo =
  | { ok: true; venta: VentaRecord }
  | { ok: false; motivo: 'no_encontrada' | 'sin_saldo_pendiente' | 'monto_invalido' };

export interface ListaVentas {
  items: VentaRecord[];
  total: number;
}

export interface FiltrosVentas {
  pagina: number;
  pageSize: number;
  desde: string;
  hasta: string;
  forma: string;
  cliente: string;
  productoId: string;
  numeroVenta: string;
  mostrarAnuladas: boolean;
}

export const VENTAS_REPOSITORY = Symbol('VENTAS_REPOSITORY');

/**
 * Puerto de persistencia de Venta. Implementación real:
 * PrismaVentasRepository. confirmar() valida producto/variante/cliente/
 * ubicación contra la empresa (aislamiento multi-tenant) y crea, en una
 * sola transacción: la Venta, sus VentaItem, y un MovimientoInventario
 * (tipo 'venta', signo -1) por item. Los totales (totalSinInteres/
 * totalConInteres) se recalculan siempre server-side a partir de los
 * items - nunca se confía en un monto que mande el cliente.
 */
export interface VentasRepository {
  listar(empresaId: string, filtro: FiltrosVentas): Promise<ListaVentas>;
  ficha(empresaId: string, id: string): Promise<VentaFicha | null>;
  rango(empresaId: string): Promise<{ desde: string; hasta: string } | null>;
  confirmar(empresaId: string, input: ConfirmarVentaInput): Promise<ResultadoConfirmarVenta>;
  /** Revierte cada MovimientoInventario original (signo +1) y crea el registro de Anulacion. */
  anular(empresaId: string, usuarioId: string, id: string, motivo: string): Promise<ResultadoAnularVenta>;
  cobrarSaldo(
    empresaId: string,
    id: string,
    monto: number,
    formaPago: string,
    fecha: Date,
  ): Promise<ResultadoCobrarSaldo>;
}
