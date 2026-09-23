import type { HistorialPrecio, InsightProducto, ItemInsight, PuntoSerieDia, VarianteInsight, VentaInsight } from './insights.util.js';

export const INSIGHTS_REPOSITORY = Symbol('INSIGHTS_REPOSITORY');

/**
 * Puerto de lectura de los datos que alimentan los algoritmos de
 * insights.util.ts - equivalente a la carga de datos de cargarInsights()
 * (src/lib/insights.ts), sin las funciones RPC/paginación de Supabase.
 */
export interface InsightsRepository {
  /** Productos activos/inactivos con costo, precio y stock actual (igual criterio que dashboard: SUM(cantidad*signo)). */
  productosConStock(empresaId: string): Promise<InsightProducto[]>;
  /** Ventas en [desde, hasta] (fecha de negocio, no created_at). total = con_interes > 0 ? con_interes : sin_interes (sin fallback a items, distinto de dashboard/periodo). */
  ventasRango(empresaId: string, desde: string, hasta: string): Promise<VentaInsight[]>;
  itemsDeVentas(empresaId: string, ventaIds: string[]): Promise<ItemInsight[]>;
  /** Historial completo de precios de la empresa (no acotado por rango), ordenado por fecha_desde. */
  historialPrecios(empresaId: string): Promise<HistorialPrecio[]>;
  /** Días desde la primera venta histórica (no limitada a ningún rango). */
  diasDesdePrimeraVenta(empresaId: string, hoy: string): Promise<number>;
  /** Serie diaria de TODO el historial de ventas (total_con_interes puro, sin fallback) - preferida sobre el rango acotado para el forecast. */
  serieVentasHistorial(empresaId: string): Promise<PuntoSerieDia[]>;
  /** configuracion_empresa.usa_variantes. */
  usaVariantes(empresaId: string): Promise<boolean>;
  variantesDeProductos(empresaId: string, productoIds: string[]): Promise<VarianteInsight[]>;
  /** Stock actual por variante (igual criterio que por producto: SUM(cantidad*signo) en movimientos_inventario). */
  stockPorVariante(empresaId: string, varianteIds: string[]): Promise<Map<string, number>>;
}
