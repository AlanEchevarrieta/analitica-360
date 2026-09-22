/** Puerto directo de src/lib/productos.ts::esBusquedaCodigoBarras (legacy). */
export function esBusquedaCodigoBarras(texto: string): boolean {
  const q = texto.trim();
  return q.length > 8 && /^\d+$/.test(q);
}

/** Puerto de la regla de margen de src/lib/productos.ts::listarProductosPaginado. */
export function margenDeProducto(precioVenta: number | null, costo: number | null): number | null {
  if (precioVenta == null || precioVenta <= 0 || costo == null) return null;
  return ((precioVenta - costo) / precioVenta) * 100;
}

export function coincideMargen(
  margen: 'todos' | 'alto' | 'medio' | 'bajo',
  precioVenta: number | null,
  costo: number | null,
): boolean {
  if (margen === 'todos') return true;
  const pct = margenDeProducto(precioVenta, costo);
  if (pct == null) return false;
  if (margen === 'alto') return pct > 40;
  if (margen === 'medio') return pct >= 20 && pct <= 40;
  return pct < 20;
}
