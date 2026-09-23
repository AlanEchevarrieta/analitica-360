import type { ItemCogs, VentaConCogs } from './contabilidad.util.js';

export interface ValorStock {
  invertido: number;
  valorVenta: number;
  gananciaPotencial: number;
}

export const CONTABILIDAD_REPOSITORY = Symbol('CONTABILIDAD_REPOSITORY');

/**
 * Puerto de lectura de ventas+COGS y valorización de stock - equivalente a
 * ventasConItems()/calcularValorStock() (src/lib/contabilidad.ts).
 */
export interface ContabilidadRepository {
  /** Ventas (con total = total_con_interes) y sus ítems (costo = cantidad*costo_unitario), en [desde, hasta]. */
  ventasConItems(empresaId: string, desde: string, hasta: string): Promise<{ ventas: VentaConCogs[]; items: ItemCogs[] }>;
  /** Valorización del stock activo (solo productos con stock > 0), mismo criterio que dashboard/insights: SUM(cantidad*signo). */
  valorStock(empresaId: string): Promise<ValorStock>;
}
