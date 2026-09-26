import type { CompraDato, MontoDia, MovimientoFinancieroDato, SeniaDato, TipoMovimientoFinanciero } from './estados-contables.util.js';

export interface MovimientoFinanciero {
  id: string;
  tipo: TipoMovimientoFinanciero;
  monto: number;
  fecha: string;
  descripcion: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  vidaUtilMeses: number | null;
  conCaja: boolean;
}

export interface CrearMovimientoFinancieroInput {
  empresaId: string;
  usuarioId: string;
  tipo: TipoMovimientoFinanciero;
  monto: number;
  fecha: string;
  descripcion: string;
  proveedorId: string | null;
  vidaUtilMeses: number | null;
  conCaja: boolean;
}

export interface DeudaProveedor {
  proveedorId: string | null;
  nombre: string;
  comprado: number;
  pagado: number;
  saldo: number;
}

export const ESTADOS_CONTABLES_REPOSITORY = Symbol('ESTADOS_CONTABLES_REPOSITORY');

/** Lectura de lo que hace falta para los estados contables, todo hasta el cierre de `hasta` (día AR). */
export interface EstadosContablesRepository {
  /**
   * Ventas por día (ingreso, costo y cantidad) hasta el cierre de `hasta`.
   * Agregado en la base: con 21.000 ventas eran 21.000 filas procesadas en el servidor.
   */
  ventasPorDia(empresaId: string, hasta: string): Promise<{ fecha: string; ingreso: number; cogs: number; ventas: number }[]>;
  /** Efecto de devoluciones y cambios por día (ingreso y costo netos), hasta el cierre de `hasta`. */
  devolucionesPorDia(empresaId: string, hasta: string): Promise<{ fecha: string; ingreso: number; costo: number }[]>;
  /** Plata cobrada por ventas por día: la seña (o el total) al vender y el saldo cuando se cobra. */
  cobrosPorDia(empresaId: string, hasta: string): Promise<MontoDia[]>;
  senias(empresaId: string, hasta: string): Promise<SeniaDato[]>;
  compras(empresaId: string, hasta: string): Promise<CompraDato[]>;
  movimientosDatos(empresaId: string, hasta: string): Promise<MovimientoFinancieroDato[]>;
  /** Mercadería valuada al costo actual con las unidades que había al cierre de `fecha`. */
  valorStockAl(empresaId: string, fecha: string): Promise<number>;
  /** Mermas, roturas, pérdidas y consumo interno valuados a costo, por día. */
  perdidasPorDia(empresaId: string, hasta: string): Promise<MontoDia[]>;
  deudaPorProveedor(empresaId: string, hasta: string): Promise<DeudaProveedor[]>;

  listarMovimientos(empresaId: string, desde: string, hasta: string): Promise<MovimientoFinanciero[]>;
  crearMovimiento(input: CrearMovimientoFinancieroInput): Promise<{ ok: true; movimiento: MovimientoFinanciero } | { ok: false; motivo: 'proveedor_invalido' }>;
  anularMovimiento(empresaId: string, id: string): Promise<{ ok: true } | { ok: false; motivo: 'no_encontrado' | 'ya_anulado' }>;
}
