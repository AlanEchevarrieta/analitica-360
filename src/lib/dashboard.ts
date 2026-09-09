import type { SupabaseClient } from '@supabase/supabase-js'
import type { CumpleProximo } from './clientes'

export type DashboardDia = {
  fecha: string
  dia: string
  total: number
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
      return { fecha, dia: etiquetaDia(String(d.dia ?? d.fecha ?? '')), total: num(d.total) }
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
