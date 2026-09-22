/** Puerto de src/lib/analytics.ts::fechaHoyAR (fecha de hoy en huso AR, formato YYYY-MM-DD). */
export function fechaHoyAR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

/** Puerto de src/lib/analytics.ts::sumarDiasIso. */
export function sumarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

export type EstadoLote = 'vencido' | 'por_vencer' | 'vigente' | 'sin_vencimiento';

/** Puerto de src/lib/lotes.ts::estadoLote (ventana "por vencer" = 30 días). */
export function estadoLote(fechaVencimiento: string | null, hoy = fechaHoyAR()): EstadoLote {
  if (!fechaVencimiento) return 'sin_vencimiento';
  if (fechaVencimiento < hoy) return 'vencido';
  if (fechaVencimiento <= sumarDiasIso(hoy, 29)) return 'por_vencer';
  return 'vigente';
}

/** Puerto de src/lib/lotes.ts::prefijoLoteMes. */
export function prefijoLoteMes(isoFecha = fechaHoyAR()): string {
  const [y, m] = isoFecha.split('-');
  return `LOTE-${y}${m}`;
}

/**
 * Puerto de src/lib/inventario.ts::deltaStockKardex - las filas
 * 'transferencia' no mueven el stock TOTAL del producto (solo lo redistribuyen
 * entre ubicaciones), por eso no aportan al delta acumulado del kardex.
 */
export function deltaStockKardex(tipo: string, cantidad: number, signo: number): number {
  if (tipo === 'transferencia') return 0;
  return cantidad * signo;
}

/** Tipos de movimiento que representan un ajuste manual de stock (no venta/compra/traslado). */
export const TIPOS_AJUSTE = [
  'ajuste_positivo',
  'ajuste_negativo',
  'merma',
  'rotura',
  'perdida',
  'consumo_interno',
] as const;
export type TipoAjuste = (typeof TIPOS_AJUSTE)[number];

export function signoDeAjuste(tipo: TipoAjuste): 1 | -1 {
  return tipo === 'ajuste_positivo' ? 1 : -1;
}
