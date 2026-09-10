import type { SupabaseClient } from '@supabase/supabase-js'
import { fechaHoyAR, lunesIso, sumarDiasIso, truncarEtiqueta } from './analytics'
import type { CumpleProximo } from './clientes'

export type DashboardDia = {
  fecha: string
  dia: string
  total: number
  cantidad?: number
}

export type DashboardProducto = {
  nombre: string
  unidades: number
}

export type DashboardStock = {
  nombre: string
  stock: number
}

export type DashboardInicio = {
  hoy: { cantidad: number; total: number }
  semana: number
  mes: number
  comprasMes: number
  topHoy: DashboardProducto | null
  ultimos7: DashboardDia[]
  top5: DashboardProducto[]
  stock: DashboardStock[]
  alertasStock: DashboardStock[]
  cumples: CumpleProximo[]
}

const VACIO: DashboardInicio = {
  hoy: { cantidad: 0, total: 0 },
  semana: 0,
  mes: 0,
  comprasMes: 0,
  topHoy: null,
  ultimos7: [],
  top5: [],
  stock: [],
  alertasStock: [],
  cumples: [],
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function mapProductos(raw: unknown): DashboardProducto[] {
  return asArray(raw).map((item) => {
    const p = asRecord(item)
    return { nombre: String(p.nombre ?? ''), unidades: num(p.unidades) }
  })
}

function etiquetaDia(valor: string) {
  const map: Record<string, string> = {
    '0': 'dom',
    '1': 'lun',
    '2': 'mar',
    '3': 'mié',
    '4': 'jue',
    '5': 'vie',
    '6': 'sáb',
  }
  if (map[valor]) return map[valor]
  if (['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'].includes(valor)) return valor
  const d = new Date(`${valor}T12:00:00`)
  if (Number.isNaN(d.getTime())) return valor
  return ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getDay()] ?? valor
}

export function procesarDatosGrafico(dias: DashboardInicio['ultimos7'] | undefined) {
  return dias ?? []
}

export function procesarTopProductos(top: DashboardInicio['top5'] | undefined) {
  return (top ?? []).map((p) => ({ ...p, etiqueta: truncarEtiqueta(p.nombre) }))
}

export async function cargarDashboardInicio(client: SupabaseClient): Promise<DashboardInicio> {
  const { data, error } = await client.rpc('dashboard_inicio')
  if (error || data == null) return VACIO
  const row = asRecord(data)
  const hoy = asRecord(row.ventas_hoy ?? row.hoy)
  const topHoy = asRecord(row.top_hoy)
  const ultimos7 = asArray(row.ventas_7dias ?? row.ultimos_7)
  const top5 = mapProductos(row.top_productos ?? row.top_5)
  const stock = asArray(row.stock)
  const cumples = asArray(row.cumpleanos_proximos).map((item) => {
    const c = asRecord(item)
    return {
      id: String(c.id ?? c.nombre ?? ''),
      nombre: String(c.nombre ?? ''),
      dias: num(c.dias),
    }
  })
  return {
    hoy: { cantidad: num(hoy.cantidad), total: num(hoy.total) },
    semana: num(row.ventas_semana ?? row.semana),
    mes: num(row.ventas_mes ?? row.mes),
    comprasMes: num(row.compras_mes),
    topHoy: topHoy.nombre
      ? { nombre: String(topHoy.nombre), unidades: num(topHoy.unidades) }
      : null,
    ultimos7: ultimos7.map((item) => {
      const d = asRecord(item)
      const fecha = String(d.fecha ?? d.dia ?? '')
      return {
        fecha,
        dia: etiquetaDia(String(d.dia ?? d.fecha ?? '')),
        total: num(d.total),
        cantidad: d.cantidad == null ? undefined : num(d.cantidad),
      }
    }),
    top5,
    stock: stock.map((item) => {
      const p = asRecord(item)
      return { nombre: String(p.nombre ?? ''), stock: num(p.stock) }
    }),
    alertasStock: asArray(row.alertas_stock).map((item) => {
      const p = asRecord(item)
      return { nombre: String(p.nombre ?? ''), stock: num(p.stock) }
    }),
    cumples,
  }
}

export type RangoHome = 7 | 30 | 90

function fechaCalendario(raw: unknown): string {
  const s = String(raw ?? '').trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m && (s.length === 10 || (!s.includes('T') && !s.includes(' ')))) return m[1]
  if (s.includes('T') || /[zZ]|[+-]\d{2}:?\d{2}/.test(s)) {
    return new Date(s).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  }
  if (m) return m[1]
  return s.slice(0, 10)
}

function totalVenta(row: Record<string, unknown>) {
  const con = num(row.total_con_interes)
  if (con > 0) return con
  return num(row.total_sin_interes)
}

export async function cargarSerieVentasHome(client: SupabaseClient): Promise<DashboardDia[]> {
  const hoy = fechaHoyAR()
  const desde = sumarDiasIso(hoy, -89)
  const filas: { fecha: string; total: number; cantidad: number }[] = []
  let from = 0
  const PAGE = 1000
  for (;;) {
    const res = await client
      .from('ventas')
      .select('fecha, total_con_interes, total_sin_interes')
      .is('deleted_at', null)
      .gte('fecha', `${desde}T00:00:00.000-03:00`)
      .lte('fecha', `${hoy}T23:59:59.999-03:00`)
      .order('fecha', { ascending: true })
      .range(from, from + PAGE - 1)
    if (res.error) return []
    const chunk = (res.data ?? []) as Record<string, unknown>[]
    for (const row of chunk) {
      filas.push({
        fecha: fechaCalendario(row.fecha),
        total: totalVenta(row),
        cantidad: 1,
      })
    }
    if (chunk.length < PAGE) break
    from += PAGE
    if (from >= 12_000) break
  }
  const porDia = new Map<string, { total: number; cantidad: number }>()
  for (const f of filas) {
    if (f.fecha < desde || f.fecha > hoy) continue
    const prev = porDia.get(f.fecha) ?? { total: 0, cantidad: 0 }
    prev.total += f.total
    prev.cantidad += f.cantidad
    porDia.set(f.fecha, prev)
  }
  const out: DashboardDia[] = []
  for (let d = desde; d <= hoy; d = sumarDiasIso(d, 1)) {
    const v = porDia.get(d) ?? { total: 0, cantidad: 0 }
    out.push({ fecha: d, dia: etiquetaDia(d), total: v.total, cantidad: v.cantidad })
  }
  return out
}

export function recortarSerieHome(serie: DashboardDia[], rango: RangoHome): DashboardDia[] {
  if (rango !== 90) return serie.slice(-rango)
  const map = new Map<string, { total: number; cantidad: number }>()
  for (const p of serie) {
    const lun = lunesIso(p.fecha)
    const prev = map.get(lun) ?? { total: 0, cantidad: 0 }
    prev.total += p.total
    prev.cantidad += (p.cantidad ?? 0)
    map.set(lun, prev)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, v]) => ({
      fecha,
      dia: etiquetaDia(fecha),
      total: v.total,
      cantidad: v.cantidad,
    }))
}
