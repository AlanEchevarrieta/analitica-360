export type TipoDevolucion = 'devolucion' | 'cambio';
export type EstadoDevolucion = 'pendiente' | 'procesado' | 'cancelado';
export type TipoItemDevolucion = 'devuelto' | 'entregado';

export interface ItemDevolucionInput {
  productoId: string;
  varianteId?: string | null;
  cantidad: number;
  precioUnitario: number;
  tipo: TipoItemDevolucion;
}

export interface DevolucionItemRecord {
  id: string;
  productoId: string;
  productoNombre: string;
  varianteId: string | null;
  cantidad: number;
  precioUnitario: number;
  tipo: TipoItemDevolucion;
}

export interface MovimientoDevolucionRecord {
  id: string;
  tipo: string;
  cantidad: number;
  signo: number;
  fecha: Date;
}

export interface DevolucionRecord {
  id: string;
  empresaId: string;
  numero: number | null;
  tipo: TipoDevolucion;
  estado: EstadoDevolucion;
  fecha: Date;
  ventaId: string | null;
  ventaLabel: string | null;
  motivo: string | null;
  notas: string | null;
  /** Concatenado ("Yerba × 2 (trae), Mate × 1 (lleva)"), para la lista. */
  productos: string;
}

export interface DevolucionFicha extends DevolucionRecord {
  items: DevolucionItemRecord[];
  movimientos: MovimientoDevolucionRecord[];
}

export interface RegistrarDevolucionInput {
  usuarioId: string;
  tipo: TipoDevolucion;
  ventaId: string | null;
  motivo: string | null;
  notas: string | null;
  items: ItemDevolucionInput[];
}

export type MotivoRechazoDevolucion = 'sin_items' | 'item_invalido' | 'venta_invalida';

export type ResultadoRegistrarDevolucion =
  | { ok: true; devolucion: DevolucionFicha }
  | { ok: false; motivo: MotivoRechazoDevolucion };

export type ResultadoTransicionDevolucion = 'ok' | 'no_encontrada' | 'no_pendiente';

export interface VentaBusquedaHit {
  id: string;
  label: string;
  items: { productoId: string; nombre: string; cantidad: number; precioUnitario: number }[];
}

export interface FiltrosDevoluciones {
  tipo: string;
  estado: string;
  desde: string;
  hasta: string;
}

export const DEVOLUCIONES_REPOSITORY = Symbol('DEVOLUCIONES_REPOSITORY');

/**
 * Puerto de persistencia de Devolucion. Implementación real:
 * PrismaDevolucionesRepository. registrar() valida producto/variante/venta
 * contra la empresa y, en la misma transacción, crea la Devolucion + sus
 * DevolucionItem + un MovimientoInventario por item: 'devuelto' entra
 * (tipo 'devolucion_cliente', signo +1), 'entregado' sale (tipo 'cambio',
 * signo -1) - solo válido en tipo 'cambio'. cancelar() (solo si
 * 'pendiente') revierte esos movimientos.
 */
export interface DevolucionesRepository {
  listar(empresaId: string, filtro: FiltrosDevoluciones): Promise<DevolucionRecord[]>;
  ficha(empresaId: string, id: string): Promise<DevolucionFicha | null>;
  registrar(empresaId: string, input: RegistrarDevolucionInput): Promise<ResultadoRegistrarDevolucion>;
  procesar(empresaId: string, id: string): Promise<ResultadoTransicionDevolucion>;
  cancelar(empresaId: string, usuarioId: string, id: string): Promise<ResultadoTransicionDevolucion>;
  buscarVentas(empresaId: string, q: string): Promise<VentaBusquedaHit[]>;
}
