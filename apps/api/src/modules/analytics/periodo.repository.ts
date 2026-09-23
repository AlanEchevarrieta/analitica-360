export type GranularidadPeriodo = 'dia' | 'semana' | 'mes';

export interface AnalyticsPeriodoProducto {
  producto: string;
  unidades: number;
  total: number;
  costo: number;
  margen: number;
  margenPct: number;
}

export interface AnalyticsVentaCobrada {
  fecha: Date;
  total: number;
  formaPago: string;
}

/** Todo lo que resuelve la CTE `periodo` + `costos` + `por_producto` de analytics_periodo(). */
export interface AnalyticsPeriodoBase {
  totalVentas: number;
  cantidad: number;
  ticketPromedio: number;
  costo: number;
  porCobrar: number;
  ventas: AnalyticsVentaCobrada[];
  productos: AnalyticsPeriodoProducto[];
}

export interface AnalyticsEvolucionPunto {
  fecha: string;
  total: number;
  anterior: number;
  cantidad: number;
}

export interface AnalyticsFormaPago {
  nombre: string;
  total: number;
  cantidad: number;
}

export interface AnalyticsTopProducto {
  nombre: string;
  unidades: number;
  total: number;
}

export const ANALYTICS_PERIODO_REPOSITORY = Symbol('ANALYTICS_PERIODO_REPOSITORY');

/**
 * Puerto fiel de las funciones SQL reales detrás de `cargarAnalyticsPeriodo`
 * (src/lib/analytics.ts), ubicadas en supabase/*.sql:
 * - analytics_periodo: última definición en 072_analytics_periodo_productos.sql
 *   (restaura `productos`/`top_10` que 068_senias.sql había omitido; antes
 *   redefinida en 014/019/034/042/043/058/068).
 * - analytics_evolucion / analytics_formas_pago / analytics_top_productos:
 *   definidas en 042_analytics_agregados.sql, sin redefiniciones posteriores.
 * - monto_venta (usada por evolucion/formas_pago): última definición en
 *   068_senias.sql.
 *
 * `analytics_periodo` calcula "cobrado" con una fórmula más simple
 * (total_con_interes - saldo_pendiente, sin fallback a total_sin_interes ni
 * a items) que `monto_venta` (con fallback vía NULLIF). Es una inconsistencia
 * real del legacy entre ambas funciones - se preserva tal cual en el puerto.
 *
 * No se incluye el filtro por ubicación (`idsMovimientosUbicacion` +
 * `ventasPeriodoPorIds`) ni compras del período / variantes: son rutas de
 * código separadas del legacy, quedan para una pasada siguiente.
 */
export interface AnalyticsPeriodoRepository {
  /** Puerto de analytics_contar_ventas() - gate de LIMITE_ANALYTICS_VENTAS antes de cargar el resto. */
  contarVentas(empresaId: string, desde: string, hasta: string): Promise<number>;
  /** Puerto de analytics_periodo(): total/cantidad/ticket/costo/por_cobrar + detalle de ventas y productos del período. */
  periodoBase(empresaId: string, desde: string, hasta: string): Promise<AnalyticsPeriodoBase>;
  /** Puerto de analytics_evolucion(): serie por día/semana/mes con comparación contra el período anterior de igual duración. */
  evolucion(empresaId: string, desde: string, hasta: string, granularidad: GranularidadPeriodo): Promise<AnalyticsEvolucionPunto[]>;
  /** Puerto de analytics_formas_pago(). */
  formasPago(empresaId: string, desde: string, hasta: string): Promise<AnalyticsFormaPago[]>;
  /** Puerto de analytics_top_productos(): top 10 por facturación (no por unidades). */
  topProductos(empresaId: string, desde: string, hasta: string): Promise<AnalyticsTopProducto[]>;
}
