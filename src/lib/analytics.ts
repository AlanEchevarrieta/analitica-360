import type { SupabaseClient } from '@supabase/supabase-js'

export type AnalyticsPunto = { fecha: string; fechaExacta: string; Ventas: number; Anterior: number }
export type AnalyticsPago = { name: string; value: number }
export type AnalyticsTop = { nombre: string; unidades: number }
export type AnalyticsProducto = {
  producto: string
  unidades: number
  total: number
  costo: number
  margen: number
  margen_pct: number
}

export type AnalyticsClientes = {
  hay: boolean
  activos: number
  ticket: number
  topNombre: string
  topTotal: number
  pctNuevos: number
  pctRecurrentes: number
}

export type AnalyticsPeriodo = {
  total: number
  cantidad: number
  costo: number
  totalAnt: number
  cantidadAnt: number
  costoAnt: number
  evolucion: AnalyticsPunto[]
  formasPago: AnalyticsPago[]
  top10: AnalyticsTop[]
  productos: AnalyticsProducto[]
  clientes: AnalyticsClientes
}

const VACIO: AnalyticsPeriodo = {
  total: 0,
  cantidad: 0,
  costo: 0,
  totalAnt: 0,
  cantidadAnt: 0,
  costoAnt: 0,
  evolucion: [],
  formasPago: [],
  top10: [],
  productos: [],
  clientes: {
    hay: false,
    activos: 0,
    ticket: 0,
    topNombre: '',
    topTotal: 0,
    pctNuevos: 0,
    pctRecurrentes: 0,
  },
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function variacionPct(actual: number, anterior: number) {
  if (anterior === 0) return actual === 0 ? 0 : 100
  return ((actual - anterior) / anterior) * 100
}

export function ticketPromedio(total: number, cantidad: number) {
  return cantidad > 0 ? total / cantidad : 0
}

export function margenPct(total: number, costo: number) {
  if (total <= 0) return 0
  return ((total - costo) / total) * 100
}

export function fechaHoyAR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

export function sumarDiasIso(iso: string, dias: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dias)
  return dt.toISOString().slice(0, 10)
}

export type PresetPeriodo = 'semana' | 'mes' | 'tres_meses' | 'anio' | 'personalizado'

export function rangoPreset(preset: PresetPeriodo, desde?: string, hasta?: string) {
  const hoy = fechaHoyAR()
  if (preset === 'personalizado') {
    return { desde: desde || sumarDiasIso(hoy, -29), hasta: hasta || hoy }
  }
  const dias =
    preset === 'semana' ? 6 : preset === 'mes' ? 29 : preset === 'tres_meses' ? 89 : 364
  return { desde: sumarDiasIso(hoy, -dias), hasta: hoy }
}

function labelFecha(iso: string) {
  const raw = String(iso).slice(0, 10)
  const [y, m, d] = raw.split('-').map(Number)
  if (!y || !m || !d) return raw
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export function fechaExactaLarga(iso: string) {
  const raw = String(iso).slice(0, 10)
  const [y, m, d] = raw.split('-').map(Number)
  if (!y || !m || !d) return raw
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatoEjeCompacto(valor: number) {
  const abs = Math.abs(valor)
  const signo = valor < 0 ? '-' : ''
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    const s = m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '')
    return `${signo}$${s}M`
  }
  if (abs >= 1000) {
    const k = abs / 1000
    const s = k >= 100 ? Math.round(k).toString() : k.toFixed(k >= 10 ? 0 : 1).replace(/\.0$/, '')
    return `${signo}$${s}k`
  }
  return `${signo}$${Math.round(abs)}`
}

export const COLOR_FORMA_PAGO: Record<string, string> = {
  Transferencia: '#6366F1',
  Crédito: '#8B5CF6',
  Efectivo: '#4ADE80',
  Débito: '#38BDF8',
  'MP QR': '#F59E0B',
}

export function colorFormaPago(nombre: string) {
  return COLOR_FORMA_PAGO[nombre] ?? '#94A3B8'
}

export async function cargarAnalyticsPeriodo(
  client: SupabaseClient,
  desde: string,
  hasta: string,
): Promise<AnalyticsPeriodo> {
  const { data, error } = await client.rpc('analytics_periodo', {
    p_desde: desde,
    p_hasta: hasta,
  })
  if (error || data == null) return VACIO
  const row = data as Record<string, unknown>
  const evolucion = Array.isArray(row.evolucion) ? row.evolucion : []
  const formas = Array.isArray(row.formas_pago) ? row.formas_pago : []
  const top10 = Array.isArray(row.top_10) ? row.top_10 : []
  const productos = Array.isArray(row.productos) ? row.productos : []
  return {
    total: num(row.total),
    cantidad: num(row.cantidad),
    costo: num(row.costo),
    totalAnt: num(row.total_ant),
    cantidadAnt: num(row.cantidad_ant),
    costoAnt: num(row.costo_ant),
    evolucion: evolucion.map((item) => {
      const p = item as Record<string, unknown>
      const iso = String(p.fecha ?? '').slice(0, 10)
      return { fecha: labelFecha(iso), fechaExacta: iso, Ventas: num(p.Ventas), Anterior: num(p.Anterior) }
    }),
    formasPago: formas.map((item) => {
      const p = item as Record<string, unknown>
      return { name: String(p.name ?? ''), value: num(p.value) }
    }),
    top10: top10.map((item) => {
      const p = item as Record<string, unknown>
      return { nombre: String(p.nombre ?? ''), unidades: num(p.unidades) }
    }),
    productos: productos.map((item) => {
      const p = item as Record<string, unknown>
      return {
        producto: String(p.producto ?? ''),
        unidades: num(p.unidades),
        total: num(p.total),
        costo: num(p.costo),
        margen: num(p.margen),
        margen_pct: num(p.margen_pct),
      }
    }),
    clientes: parseClientes(row.clientes),
  }
}

function parseClientes(raw: unknown): AnalyticsClientes {
  const vacio: AnalyticsClientes = {
    hay: false,
    activos: 0,
    ticket: 0,
    topNombre: '',
    topTotal: 0,
    pctNuevos: 0,
    pctRecurrentes: 0,
  }
  if (!raw || typeof raw !== 'object') return vacio
  const p = raw as Record<string, unknown>
  if (!p.hay) return vacio
  return {
    hay: true,
    activos: num(p.activos),
    ticket: num(p.ticket),
    topNombre: String(p.top_nombre ?? ''),
    topTotal: num(p.top_total),
    pctNuevos: num(p.pct_nuevos),
    pctRecurrentes: num(p.pct_recurrentes),
  }
}

export function truncarEtiqueta(nombre: string) {
  if (nombre.length <= 15) return nombre
  return `${nombre.slice(0, 15)}...`
}

export type CuadranteProducto = 'Estrella' | 'Premium' | 'Volumen' | 'Revisar'

export const COLOR_CUADRANTE: Record<CuadranteProducto, string> = {
  Estrella: '#4ADE80',
  Premium: '#F59E0B',
  Volumen: '#6366F1',
  Revisar: '#F87171',
}

export function cuadranteProducto(unidades: number, margenPctVal: number, avgU: number, avgM: number): CuadranteProducto {
  const altaRot = unidades >= avgU
  const altoMar = margenPctVal >= avgM
  if (altoMar && altaRot) return 'Estrella'
  if (altoMar && !altaRot) return 'Premium'
  if (!altoMar && altaRot) return 'Volumen'
  return 'Revisar'
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const

export function ventasPorDiaSemana(puntos: AnalyticsPunto[]) {
  const tot = [0, 0, 0, 0, 0, 0, 0]
  for (const p of puntos) {
    const raw = p.fechaExacta.slice(0, 10)
    const [y, m, d] = raw.split('-').map(Number)
    if (!y || !m || !d) continue
    const js = new Date(y, m - 1, d).getDay()
    const idx = js === 0 ? 6 : js - 1
    tot[idx] += p.Ventas
  }
  const max = Math.max(...tot, 0)
  return DIAS_SEMANA.map((dia, i) => ({
    dia,
    total: tot[i],
    destacado: max > 0 && tot[i] === max,
  }))
}
