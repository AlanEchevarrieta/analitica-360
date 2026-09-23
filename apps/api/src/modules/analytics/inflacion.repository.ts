export const INFLACION_REPOSITORY = Symbol('INFLACION_REPOSITORY');

/**
 * Puerto de lectura de precios promedio por mes - equivalente a
 * preciosPromedioHistorial()/preciosPromedioVentasItems()
 * (src/lib/inflacion.ts). `desde`/`hasta` son YYYY-MM-DD; ambos métodos
 * extienden internamente la ventana un mes hacia atrás (igual que el
 * legacy) para poder calcular la variación del primer mes del rango.
 */
export interface InflacionRepository {
  /** Precio promedio por mes desde precios_historial.precio_venta. */
  preciosPromedioHistorial(empresaId: string, desde: string, hasta: string): Promise<Map<string, number>>;
  /** Fallback cuando no hay historial: precio promedio por mes desde ventas_items.precio_unitario. */
  preciosPromedioVentasItems(empresaId: string, desde: string, hasta: string): Promise<Map<string, number>>;
}
