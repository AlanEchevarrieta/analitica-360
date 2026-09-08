import type { SupabaseClient } from '@supabase/supabase-js'

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
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function cargarDashboardInicio(client: SupabaseClient): Promise<DashboardInicio> {
  const { data, error } = await client.rpc('dashboard_inicio')
  if (error || data == null) return VACIO
  const row = data as Record<string, unknown>
  const hoy = (row.hoy ?? {}) as Record<string, unknown>
  const topHoy = row.top_hoy as Record<string, unknown> | null
  const ultimos7 = Array.isArray(row.ultimos_7) ? row.ultimos_7 : []
  const top5 = Array.isArray(row.top_5) ? row.top_5 : []
  const stock = Array.isArray(row.stock) ? row.stock : []
  return {
    hoy: { cantidad: num(hoy.cantidad), total: num(hoy.total) },
    semana: num(row.semana),
    mes: num(row.mes),
    comprasMes: num(row.compras_mes),
    topHoy:
      topHoy && topHoy.nombre
        ? { nombre: String(topHoy.nombre), unidades: num(topHoy.unidades) }
        : null,
    ultimos7: ultimos7.map((item) => {
      const d = item as Record<string, unknown>
      return { fecha: String(d.fecha ?? ''), dia: String(d.dia ?? ''), total: num(d.total) }
    }),
    top5: top5.map((item) => {
      const p = item as Record<string, unknown>
      return { nombre: String(p.nombre ?? ''), unidades: num(p.unidades) }
    }),
    stock: stock.map((item) => {
      const p = item as Record<string, unknown>
      return { nombre: String(p.nombre ?? ''), stock: num(p.stock) }
    }),
  }
}
