/**
 * Cuántas veces cae un gasto recurrente entre `desde` y `hasta` (AAAA-MM-DD),
 * con la misma regla que la API (contabilidad.util.ts → expandirRecurrentes):
 * cada 7 días, cada 15 días o el mismo día de cada mes, desde su fecha.
 */
export function vecesEnPeriodo(g: { fecha: string; frecuencia: "mensual" | "quincenal" | "semanal" | null }, desde: string, hasta: string): number {
  const inicio = g.fecha.slice(0, 10);
  if (!g.frecuencia) return inicio >= desde && inicio <= hasta ? 1 : 0;
  const [y, m, d] = inicio.split("-").map(Number);
  let veces = 0;
  for (let i = 0; i < 1000; i++) {
    const f =
      g.frecuencia === "mensual"
        ? new Date(Date.UTC(y, m - 1 + i, Math.min(d, new Date(Date.UTC(y, m + i, 0)).getUTCDate())))
        : new Date(Date.UTC(y, m - 1, d + (g.frecuencia === "semanal" ? 7 : 15) * i));
    const iso = f.toISOString().slice(0, 10);
    if (iso > hasta) break;
    if (iso >= desde) veces++;
  }
  return veces;
}
