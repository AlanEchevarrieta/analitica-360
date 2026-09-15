export const TZ_AR = 'America/Argentina/Mendoza'

const OPCIONES_DIA = {
  timeZone: TZ_AR,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
} as const

const OPCIONES_HORA = {
  ...OPCIONES_DIA,
  hour: '2-digit',
  minute: '2-digit',
} as const

function esFechaSoloDia(fecha: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())
}

/** Instantes UTC (ventas, pedidos, tickets) en hora de Mendoza. */
export function formatoFechaHora(fecha: string) {
  if (esFechaSoloDia(fecha)) return formatoFechaDia(fecha)
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleString('es-AR', OPCIONES_HORA)
}

/** Días de calendario (compras, lotes, OC) sin corrimiento UTC. */
export function formatoFechaDia(fecha: string) {
  const raw = String(fecha).trim()
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const d = m ? new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00-03:00`) : new Date(fecha)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleDateString('es-AR', OPCIONES_DIA)
}
