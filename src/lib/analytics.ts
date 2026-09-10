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
  evolucionDiaria: AnalyticsPunto[]
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
  evolucionDiaria: [],
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

export function lunesIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay()
  dt.setUTCDate(dt.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
  return dt.toISOString().slice(0, 10)
}

export function inicioMesIso(iso: string) {
  return `${iso.slice(0, 7)}-01`
}

export type GranularidadEje = 'dia' | 'semana' | 'mes'

export function agruparEvolucion(puntos: AnalyticsPunto[], g: GranularidadEje): AnalyticsPunto[] {
  if (g === 'dia' || puntos.length === 0) return puntos
  const map = new Map<string, { Ventas: number; Anterior: number }>()
  for (const p of puntos) {
    const iso = p.fechaExacta.slice(0, 10)
    const key = g === 'semana' ? lunesIso(iso) : inicioMesIso(iso)
    const prev = map.get(key) ?? { Ventas: 0, Anterior: 0 }
    prev.Ventas += p.Ventas
    prev.Anterior += p.Anterior
    map.set(key, prev)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({
      fecha: g === 'mes' ? labelMes(key) : labelFecha(key),
      fechaExacta: key,
      Ventas: v.Ventas,
      Anterior: v.Anterior,
    }))
}

function labelMes(iso: string) {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }).replace('.', '')
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

function evolucionDesdeVentas(raw: unknown): AnalyticsPunto[] {
  const ventas = Array.isArray(raw) ? raw : []
  const porDia = new Map<string, number>()
  for (const item of ventas) {
    const v = item as Record<string, unknown>
    const iso = String(v.fecha ?? '').slice(0, 10)
    if (!iso) continue
    porDia.set(iso, (porDia.get(iso) ?? 0) + num(v.total))
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, Ventas]) => ({
      fecha: labelFecha(iso),
      fechaExacta: iso,
      Ventas,
      Anterior: 0,
    }))
}

function formasDesdeVentas(raw: unknown): AnalyticsPago[] {
  const ventas = Array.isArray(raw) ? raw : []
  const porPago = new Map<string, number>()
  for (const item of ventas) {
    const v = item as Record<string, unknown>
    const name = String(v.forma_pago ?? '')
    if (!name) continue
    porPago.set(name, (porPago.get(name) ?? 0) + num(v.total))
  }
  return [...porPago.entries()].map(([name, value]) => ({ name, value }))
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

export const LIMITE_ANALYTICS_VENTAS = 50000

export async function leerEmpresaIdAnalytics(
  client: SupabaseClient,
  fallback?: string | null,
): Promise<string | null> {
  const { data: userData, error } = await client.from('usuarios').select('empresa_id').limit(1).maybeSingle()
  console.log('[analytics debug]', { rpc: 'usuarios.empresa_id', userData, error, fallback })
  if (userData?.empresa_id) return String(userData.empresa_id)
  return fallback ?? null
}

export async function contarVentasPeriodo(
  client: SupabaseClient,
  desde: string,
  hasta: string,
  empresaId?: string | null,
): Promise<{ total: number; error: string | null }> {
  const fechaInicio = desde
  const fechaFin = hasta
  const { data, error } = await client.rpc('analytics_contar_ventas', {
    p_desde: fechaInicio,
    p_hasta: fechaFin,
    p_empresa_id: empresaId ?? null,
  })
  console.log('[analytics debug]', {
    rpc: 'analytics_contar_ventas',
    data,
    error,
    fechaInicio,
    fechaFin,
    p_empresa_id: empresaId,
  })
  if (!error && data != null) return { total: Number(data), error: null }
  const fallback = await client
    .from('ventas')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .gte('fecha', `${desde}T00:00:00-03:00`)
    .lt('fecha', `${sumarDiasIso(hasta, 1)}T00:00:00-03:00`)
  console.log('[analytics debug]', {
    rpc: 'ventas.count fallback',
    count: fallback.count,
    error: fallback.error,
    fechaInicio,
    fechaFin,
  })
  if (fallback.error || fallback.count == null) {
    return { total: 0, error: error?.message ?? fallback.error?.message ?? 'No se pudo contar ventas' }
  }
  return { total: fallback.count, error: error?.message ?? null }
}

export async function cargarAnalyticsEvolucion(
  client: SupabaseClient,
  desde: string,
  hasta: string,
  granularidad: GranularidadEje,
  empresaId?: string | null,
): Promise<AnalyticsPunto[] | null> {
  const fechaInicio = desde
  const fechaFin = hasta
  const { data, error } = await client.rpc('analytics_evolucion', {
    p_desde: fechaInicio,
    p_hasta: fechaFin,
    p_granularidad: granularidad,
    p_empresa_id: empresaId ?? null,
  })
  console.log('[analytics debug]', { data, error, fechaInicio, fechaFin, granularidad, p_empresa_id: empresaId })
  if (error || data == null) return null
  return parseEvolucion(data, granularidad)
}

export async function cargarAnalyticsPeriodo(
  client: SupabaseClient,
  desde: string,
  hasta: string,
  granularidad: GranularidadEje = 'dia',
  empresaId?: string | null,
): Promise<{ data: AnalyticsPeriodo; error: string | null }> {
  const fechaInicio = desde
  const fechaFin = hasta
  const args = { p_desde: fechaInicio, p_hasta: fechaFin, p_empresa_id: empresaId ?? null }
  const [periodoRes, evoRes, pagosRes, topRes] = await Promise.all([
    client.rpc('analytics_periodo', args),
    client.rpc('analytics_evolucion', {
      ...args,
      p_granularidad: granularidad,
    }),
    client.rpc('analytics_formas_pago', args),
    client.rpc('analytics_top_productos', args),
  ])
  console.log('[analytics debug]', {
    rpc: 'analytics_periodo',
    data: periodoRes.data,
    error: periodoRes.error,
    fechaInicio,
    fechaFin,
    p_empresa_id: empresaId,
  })
  console.log('[analytics debug]', {
    data: evoRes.data,
    error: evoRes.error,
    fechaInicio,
    fechaFin,
    granularidad,
    p_empresa_id: empresaId,
  })
  console.log('[analytics debug]', {
    rpc: 'analytics_formas_pago',
    data: pagosRes.data,
    error: pagosRes.error,
    fechaInicio,
    fechaFin,
    p_empresa_id: empresaId,
  })
  console.log('[analytics debug]', {
    rpc: 'analytics_top_productos',
    data: topRes.data,
    error: topRes.error,
    fechaInicio,
    fechaFin,
    p_empresa_id: empresaId,
  })

  const errores = [periodoRes, evoRes, pagosRes, topRes]
    .map((r) => r.error?.message)
    .filter((m): m is string => Boolean(m))
  const errorTexto = errores.length > 0 ? [...new Set(errores)].join(' · ') : null

  if (periodoRes.error || periodoRes.data == null) return { data: VACIO, error: errorTexto }
  const row = periodoRes.data as Record<string, unknown>
  const productos = Array.isArray(row.productos) ? row.productos : []
  const evolucionDiaria =
    Array.isArray(row.evolucion) && row.evolucion.length > 0
      ? parseEvolucion(row.evolucion, 'dia')
      : evolucionDesdeVentas(row.ventas)
  return {
    data: {
      total: num(row.total ?? row.total_ventas),
      cantidad: num(row.cantidad),
      costo: num(row.costo),
      totalAnt: num(row.total_ant),
      cantidadAnt: num(row.cantidad_ant),
      costoAnt: num(row.costo_ant),
      evolucion:
        evoRes.error || evoRes.data == null
          ? agruparEvolucion(evolucionDiaria, granularidad)
          : parseEvolucion(evoRes.data, granularidad),
      evolucionDiaria,
      formasPago:
        pagosRes.error || pagosRes.data == null
          ? (Array.isArray(row.formas_pago) ? parseFormasPago(row.formas_pago) : formasDesdeVentas(row.ventas))
          : parseFormasPago(pagosRes.data),
      top10: topRes.error || topRes.data == null ? parseTop10(row.top_10) : parseTop10(topRes.data),
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
    },
    error: errorTexto,
  }
}

function parseEvolucion(raw: unknown, granularidad: GranularidadEje = 'dia'): AnalyticsPunto[] {
  const evolucion = Array.isArray(raw) ? raw : []
  return evolucion.map((item) => {
    const p = item as Record<string, unknown>
    const iso = String(p.fecha ?? '').slice(0, 10)
    return {
      fecha: granularidad === 'mes' ? labelMes(iso) : labelFecha(iso),
      fechaExacta: iso,
      Ventas: num(p.Ventas),
      Anterior: num(p.Anterior),
    }
  })
}

function parseFormasPago(raw: unknown): AnalyticsPago[] {
  const formas = Array.isArray(raw) ? raw : []
  return formas.map((item) => {
    const p = item as Record<string, unknown>
    return { name: String(p.name ?? ''), value: num(p.value) }
  })
}

function parseTop10(raw: unknown): AnalyticsTop[] {
  const top10 = Array.isArray(raw) ? raw : []
  return top10.map((item) => {
    const p = item as Record<string, unknown>
    return { nombre: String(p.nombre ?? ''), unidades: num(p.unidades) }
  })
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
