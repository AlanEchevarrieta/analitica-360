import type { SupabaseClient } from '@supabase/supabase-js'
import { fechaHoyAR, fechaIsoDe, inicioMesIso } from './analytics'

export const inflacionMensual: Record<string, number> = {
  '2022-01': 3.9,
  '2022-02': 4.7,
  '2022-03': 6.7,
  '2022-04': 6.0,
  '2022-05': 5.1,
  '2022-06': 5.3,
  '2022-07': 7.4,
  '2022-08': 7.0,
  '2022-09': 6.2,
  '2022-10': 6.3,
  '2022-11': 4.9,
  '2022-12': 5.1,
  '2023-01': 6.0,
  '2023-02': 6.6,
  '2023-03': 7.7,
  '2023-04': 8.4,
  '2023-05': 7.8,
  '2023-06': 6.0,
  '2023-07': 6.3,
  '2023-08': 12.4,
  '2023-09': 12.7,
  '2023-10': 8.3,
  '2023-11': 12.8,
  '2023-12': 25.5,
  '2024-01': 20.6,
  '2024-02': 13.2,
  '2024-03': 11.0,
  '2024-04': 8.8,
  '2024-05': 4.2,
  '2024-06': 4.6,
  '2024-07': 4.0,
  '2024-08': 4.2,
  '2024-09': 3.5,
  '2024-10': 2.4,
  '2024-11': 2.4,
  '2024-12': 2.7,
}

export type PuntoInflacionPrecios = {
  mes: string
  mesKey: string
  inflacion: number | null
  variacion: number | null
  diferencia: number | null
}

export type SerieInflacionPrecios = {
  puntos: PuntoInflacionPrecios[]
  hayPrecios: boolean
  insight: 'menos' | 'mas' | 'sin_datos'
}

const PAGE = 1000
const BCRA_MONETARIAS = 'https://api.bcra.gob.ar/estadisticas/v3.0/monetarias'
let cacheBcra: Promise<Record<string, number>> | null = null

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function mesKeyDe(fecha: string) {
  return fechaIsoDe(fecha).slice(0, 7)
}

function labelMesCorto(mesKey: string) {
  const [y, m] = mesKey.split('-').map(Number)
  if (!y || !m) return mesKey
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }).replace('.', '')
}

export function mesesEnRango(desde: string, hasta: string) {
  const out: string[] = []
  let cur = inicioMesIso(desde).slice(0, 7)
  const fin = hasta.slice(0, 7)
  while (cur <= fin) {
    out.push(cur)
    const [y, m] = cur.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m, 1))
    cur = dt.toISOString().slice(0, 7)
  }
  return out
}

function mesAnteriorKey(mesKey: string) {
  const [y, m] = mesKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 2, 1))
  return dt.toISOString().slice(0, 7)
}

async function paginar<T>(
  pull: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
) {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await pull(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const chunk = data ?? []
    out.push(...chunk)
    if (chunk.length < PAGE) break
    from += PAGE
    if (from > 20_000) break
  }
  return out
}

async function inflacionDesdeBcra(): Promise<Record<string, number>> {
  const ctrl = new AbortController()
  const t = window.setTimeout(() => ctrl.abort(), 8000)
  try {
    const listRes = await fetch(BCRA_MONETARIAS, { signal: ctrl.signal })
    if (!listRes.ok) return {}
    const listJson = (await listRes.json()) as { results?: { idVariable?: number; descripcion?: string }[] }
    const hallado = (listJson.results ?? []).find((r) => /inflaci[oó]n mensual/i.test(r.descripcion ?? ''))
    const id = hallado?.idVariable ?? 27
    const hoy = fechaHoyAR()
    const serieRes = await fetch(`${BCRA_MONETARIAS}/${id}?desde=2022-01-01&hasta=${hoy}`, { signal: ctrl.signal })
    if (!serieRes.ok) return {}
    const serieJson = (await serieRes.json()) as { results?: { fecha?: string; valor?: number }[] }
    const out: Record<string, number> = {}
    for (const row of serieJson.results ?? []) {
      const key = mesKeyDe(String(row.fecha ?? ''))
      const valor = num(row.valor)
      if (key.length === 7 && Number.isFinite(valor)) out[key] = valor
    }
    return out
  } catch {
    return {}
  } finally {
    window.clearTimeout(t)
  }
}

export async function mapaInflacionMensual(): Promise<Record<string, number>> {
  if (!cacheBcra) cacheBcra = inflacionDesdeBcra()
  const extra = await cacheBcra
  return { ...extra, ...inflacionMensual }
}

function promediarPorMes(filas: { mes: string; precio: number }[]) {
  const acc = new Map<string, { suma: number; n: number }>()
  for (const f of filas) {
    if (!f.mes || !(f.precio > 0)) continue
    const prev = acc.get(f.mes) ?? { suma: 0, n: 0 }
    prev.suma += f.precio
    prev.n += 1
    acc.set(f.mes, prev)
  }
  const map = new Map<string, number>()
  for (const [mes, v] of acc) {
    if (v.n > 0) map.set(mes, v.suma / v.n)
  }
  return map
}

async function preciosPromedioHistorial(client: SupabaseClient, empresaId?: string | null) {
  const rows = await paginar<Record<string, unknown>>(async (from, to) => {
    let q = client
      .from('precios_historial')
      .select('precio_venta, fecha_desde')
      .order('fecha_desde', { ascending: true })
      .range(from, to)
    if (empresaId) q = q.eq('empresa_id', empresaId)
    const res = await q
    return { data: (res.data ?? []) as Record<string, unknown>[], error: res.error }
  })
  return promediarPorMes(
    rows.map((r) => ({
      mes: mesKeyDe(String(r.fecha_desde ?? '')),
      precio: num(r.precio_venta),
    })),
  )
}

async function preciosPromedioVentasItems(
  client: SupabaseClient,
  desde: string,
  hasta: string,
  empresaId?: string | null,
) {
  const desdeExt = `${mesAnteriorKey(desde.slice(0, 7))}-01`
  const ventas = await paginar<Record<string, unknown>>(async (from, to) => {
    let q = client
      .from('ventas')
      .select('id, fecha')
      .is('deleted_at', null)
      .gte('fecha', desdeExt)
      .lte('fecha', `${hasta}T23:59:59.999`)
      .order('fecha', { ascending: true })
    if (empresaId) q = q.eq('empresa_id', empresaId)
    const res = await q.range(from, to)
    return { data: (res.data ?? []) as Record<string, unknown>[], error: res.error }
  })
  const porVenta = new Map<string, string>()
  for (const v of ventas) {
    porVenta.set(String(v.id), mesKeyDe(String(v.fecha ?? '')))
  }
  const ids = [...porVenta.keys()]
  const items: { mes: string; precio: number }[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200)
    const { data, error } = await client
      .from('ventas_items')
      .select('venta_id, precio_unitario')
      .in('venta_id', slice)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const mes = porVenta.get(String(r.venta_id)) ?? ''
      items.push({ mes, precio: num(r.precio_unitario) })
    }
  }
  return promediarPorMes(items)
}

function acumularPct(valores: number[]) {
  if (valores.length === 0) return 0
  return valores.reduce((acc, p) => acc * (1 + p / 100), 1) - 1
}

export async function cargarInflacionVsPrecios(
  client: SupabaseClient,
  desde: string,
  hasta: string,
  empresaId?: string | null,
): Promise<SerieInflacionPrecios> {
  const meses = mesesEnRango(desde, hasta)
  const inflacion = await mapaInflacionMensual()
  let historial = new Map<string, number>()
  try {
    historial = await preciosPromedioHistorial(client, empresaId)
  } catch {
    historial = new Map()
  }
  let precios = historial
  const hayHistorial = historial.size > 0
  if (!hayHistorial) {
    try {
      precios = await preciosPromedioVentasItems(client, desde, hasta, empresaId)
    } catch {
      precios = new Map()
    }
  }

  const puntos: PuntoInflacionPrecios[] = meses.map((mes) => {
    const inflacionMes = inflacion[mes]
    const actual = precios.get(mes)
    const anterior = precios.get(mesAnteriorKey(mes))
    const variacion =
      actual != null && anterior != null && anterior > 0 ? ((actual - anterior) / anterior) * 100 : null
    const infla = inflacionMes == null ? null : inflacionMes
    const diferencia = variacion != null && infla != null ? variacion - infla : null
    return {
      mes: labelMesCorto(mes),
      mesKey: mes,
      inflacion: infla ?? null,
      variacion,
      diferencia,
    }
  })

  const vars = puntos.map((p) => p.variacion).filter((v): v is number => v != null)
  const inflas = puntos.map((p) => p.inflacion).filter((v): v is number => v != null)
  const hayPrecios = vars.length > 0
  let insight: SerieInflacionPrecios['insight'] = 'sin_datos'
  if (hayPrecios && inflas.length > 0) {
    insight = acumularPct(vars) < acumularPct(inflas) ? 'menos' : 'mas'
  }

  return { puntos, hayPrecios, insight }
}
