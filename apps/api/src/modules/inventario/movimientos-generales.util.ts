/** Movimientos de stock de todos los productos (Inventario → Movimientos): nombres y grupos para filtrar. */

export const NOMBRE_TIPO: Record<string, string> = {
  venta: 'Venta',
  pedido: 'Pedido despachado',
  anulacion: 'Venta anulada',
  compra: 'Compra',
  devolucion_proveedor: 'Devolución a proveedor',
  devolucion_cliente: 'Devolución de cliente',
  cambio: 'Cambio',
  ajuste_positivo: 'Ajuste (suma)',
  ajuste_negativo: 'Ajuste (resta)',
  merma: 'Merma',
  rotura: 'Rotura',
  perdida: 'Pérdida',
  consumo_interno: 'Consumo interno',
  transferencia: 'Traslado entre ubicaciones',
  produccion: 'Producción',
  consumo_produccion: 'Insumo usado en producción',
};

export const GRUPOS_MOVIMIENTO = {
  ventas: ['venta', 'pedido', 'anulacion'],
  compras: ['compra', 'devolucion_proveedor'],
  devoluciones: ['devolucion_cliente', 'cambio'],
  ajustes: ['ajuste_positivo', 'ajuste_negativo', 'merma', 'rotura', 'perdida', 'consumo_interno'],
  traslados: ['transferencia'],
  produccion: ['produccion', 'consumo_produccion'],
} as const;
export type GrupoMovimiento = keyof typeof GRUPOS_MOVIMIENTO;

export function nombreTipo(tipo: string): string {
  return NOMBRE_TIPO[tipo] ?? tipo.replaceAll('_', ' ');
}

/** Entra, sale o se mueve de lugar (los traslados no cambian el stock total). */
export function sentido(tipo: string, signo: number): 'entra' | 'sale' | 'traslado' {
  if (tipo === 'transferencia') return 'traslado';
  return signo > 0 ? 'entra' : 'sale';
}

/** Rango de días de Argentina [desde 00:00, hasta+1 00:00) en UTC (AR = UTC−3). */
export function rangoDias(desde: string, hasta: string): { inicio: Date; fin: Date } {
  const inicio = new Date(`${desde}T03:00:00Z`);
  const fin = new Date(Date.parse(`${hasta}T03:00:00Z`) + 86_400_000);
  return { inicio, fin };
}
