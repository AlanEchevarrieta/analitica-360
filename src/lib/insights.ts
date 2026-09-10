import type { SupabaseClient } from '@supabase/supabase-js'
import { fechaHoyAR, sumarDiasIso } from './analytics'
import { listarProductos, type ProductoFila } from './productos'
import { etiquetaCombo, listarVariantesDeProductos, stockPorVariante, type VarianteFila } from './variantes'

const TZ = 'America/Argentina/Buenos_Aires'
const PAGE = 1000

export type InsightRadarEje = { eje: string; valor: number; fullMark: number }

export type InsightSalud = {
  ejes: InsightRadarEje[]
  score: number
  etiqueta: string
  color: string
  bullets: string[]
}

export type FilaElasticidad = {
  productoId: string
  producto: string
  precioAnterior: number
  precioActual: number
  deltaPrecioPct: number
  deltaVentasPct: number
  elasticidad: number
  badge: 'inelastica' | 'moderada' | 'elastica' | 'giffen'
  recomendacion: string
}

export type GranularidadForecast = 'dia' | 'semana' | 'mes'

export type PuntoForecast = {
  label: string
  historico: number | null
  proyeccion: number | null
}

export type InsightForecast = {
  diasHistorial: number
  puntos: PuntoForecast[]
  totalProyeccion: number
  tendencia: 'positiva' | 'negativa' | 'neutra'
  granularidad: GranularidadForecast
  etiquetaProyeccion: string
}

export type DistAtributo = { atributo: string; valores: { name: string; pct: number; unidades: number }[] }

export type ComboVariante = {
  id: string
  etiqueta: string
  unidades: number
  pct: number
  tendencia: 'up' | 'down' | 'flat'
}

export type InsightVariantes = {
  hayVentas: boolean
  porAtributo: DistAtributo[]
  combinaciones: ComboVariante[]
  bullets: string[]
}

export type FilaPrecioOptimo = {
  producto: string
  precioActual: number
  precioSugerido: number
  extraMes: number
}

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n))
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function isoAR(fecha: string) {
  return new Date(fecha).toLocaleDateString('en-CA', { timeZone: TZ })
}

function inicioMes(iso: string) {
  return `${iso.slice(0, 7)}-01`
}

function mesAnteriorDe(isoMes: string) {
  const [y, m] = isoMes.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 2, 1))
  return dt.toISOString().slice(0, 10)
}

function lunesDe(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay()
  dt.setUTCDate(dt.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
  return dt.toISOString().slice(0, 10)
}

/** Fecha de negocio: columna `fecha`, nunca `created_at`. */
function fechaCalendario(raw: unknown): string {
  const s = String(raw ?? '').trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m && (s.length === 10 || (!s.includes('T') && !s.includes(' ')))) return m[1]
  if (s.includes('T') || /[zZ]|[+-]\d{2}:?\d{2}/.test(s)) return isoAR(s)
  if (m) return m[1]
  return s.slice(0, 10)
}

function inicioMesHace(iso: string, mesesAtras: number) {
  const [y, m] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 - mesesAtras, 1))
  return dt.toISOString().slice(0, 10)
}

function etiquetaDia(iso: string) {
  const [y, mo, d] = iso.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function etiquetaMes(iso: string) {
  const [y, mo] = iso.split('-').map(Number)
  const t = new Date(y, mo - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
  return t.replace('.', '')
}

function tsDesde(iso: string) {
  return `${iso}T00:00:00.000-03:00`
}

function tsHasta(iso: string) {
  return `${iso}T23:59:59.999-03:00`
}

function totalVenta(row: Record<string, unknown>) {
  const con = num(row.total_con_interes)
  if (con > 0) return con
  return num(row.total_sin_interes)
}

async function paginar<T>(
  pull: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await pull(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const chunk = data ?? []
    out.push(...chunk)
    if (chunk.length < PAGE) break
    from += PAGE
    if (out.length >= 12_000) break
  }
  return out
}

type VentaMini = { id: string; fechaIso: string; clienteId: string | null; total: number }

async function cargarVentasRango(client: SupabaseClient, desde: string, hasta: string): Promise<VentaMini[]> {
  const rows = await paginar<Record<string, unknown>>(async (from, to) => {
    const res = await client
      .from('ventas')
      .select('id, fecha, cliente_id, total_con_interes, total_sin_interes')
      .is('deleted_at', null)
      .gte('fecha', tsDesde(sumarDiasIso(desde, -1)))
      .lte('fecha', tsHasta(hasta))
      .order('fecha', { ascending: true })
      .range(from, to)
    return { data: (res.data ?? []) as Record<string, unknown>[], error: res.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    fechaIso: fechaCalendario(row.fecha),
    clienteId: row.cliente_id == null || row.cliente_id === '' ? null : String(row.cliente_id),
    total: totalVenta(row),
  }))
}

type ItemMini = {
  ventaId: string
  productoId: string
  varianteId: string | null
  cantidad: number
}

async function cargarItems(client: SupabaseClient, ventaIds: string[]): Promise<ItemMini[]> {
  const out: ItemMini[] = []
  for (let i = 0; i < ventaIds.length; i += 200) {
    const slice = ventaIds.slice(i, i + 200)
    const { data, error } = await client
      .from('ventas_items')
      .select('venta_id, producto_id, variante_id, cantidad')
      .in('venta_id', slice)
    if (error) throw new Error(error.message)
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      out.push({
        ventaId: String(row.venta_id),
        productoId: String(row.producto_id),
        varianteId: row.variante_id == null || row.variante_id === '' ? null : String(row.variante_id),
        cantidad: num(row.cantidad),
      })
    }
  }
  return out
}

async function diasDesdePrimeraVenta(client: SupabaseClient, hoy: string): Promise<number> {
  const { data, error } = await client
    .from('ventas')
    .select('fecha')
    .is('deleted_at', null)
    .order('fecha', { ascending: true })
    .limit(1)
  if (error) throw new Error(error.message)
  const fecha = data?.[0] && typeof data[0] === 'object' ? String((data[0] as { fecha?: string }).fecha ?? '') : ''
  if (!fecha) return 0
  const first = fechaCalendario(fecha)
  const [y1, m1, d1] = first.split('-').map(Number)
  const [y2, m2, d2] = hoy.split('-').map(Number)
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1)
}

function interpretarElasticidad(e: number): Pick<FilaElasticidad, 'badge' | 'recomendacion'> {
  if (e > 0) {
    return { badge: 'giffen', recomendacion: 'Más precio = más ventas' }
  }
  if (e >= -0.5) {
    return { badge: 'inelastica', recomendacion: 'Podés subir precio sin perder ventas' }
  }
  if (e >= -1) {
    return { badge: 'moderada', recomendacion: 'Subí precio con cuidado' }
  }
  return { badge: 'elastica', recomendacion: 'Muy sensible al precio' }
}

function ejePrecio(filas: FilaElasticidad[]) {
  let extra = 0
  for (const f of filas) {
    if (f.badge === 'inelastica') extra += 15
    else if (f.badge === 'moderada') extra += 8
    else if (f.badge === 'giffen') extra += 10
  }
  return clamp(50 + extra)
}

function bulletsSalud(ejes: Record<string, number>, score: number) {
  const v = ejes.Ventas ?? 0
  const m = ejes.Margen ?? 0
  const s = ejes.Stock ?? 0
  const c = ejes.Clientes ?? 0
  const out: string[] = []
  if (v > 70) out.push('📈 Las ventas van en alza')
  if (v < 40) out.push('📉 Las ventas bajaron — revisá precios y stock')
  if (m > 70) out.push('✅ Tu margen es excelente')
  if (m < 40) out.push('⚠️ Margen bajo — revisá tus costos')
  if (s < 40) out.push('📦 Más del 60% de tus productos sin stock')
  if (c < 30) out.push('👥 Pocos clientes identificados — usá el CRM')
  if (score > 80) out.push('🏆 Tu negocio está en excelente forma')
  return out.slice(0, 4)
}

function semaforo(score: number): { etiqueta: string; color: string } {
  if (score >= 80) return { etiqueta: 'Negocio saludable 🟢', color: '#4ADE80' }
  if (score >= 60) return { etiqueta: 'Atención recomendada 🟡', color: '#FCD34D' }
  return { etiqueta: 'Requiere acción 🔴', color: '#F87171' }
}

export function calcularSalud(input: {
  ventasMes: number
  ventasMesAnt: number
  hayMesAnterior: boolean
  productos: ProductoFila[]
  ventas: VentaMini[]
  elasticidades: FilaElasticidad[]
}): InsightSalud {
  let ventasEje = 50
  if (input.hayMesAnterior) {
    if (input.ventasMesAnt <= 0) ventasEje = input.ventasMes > 0 ? 100 : 50
    else ventasEje = clamp((input.ventasMes / input.ventasMesAnt) * 50)
  }

  const conCosto = input.productos.filter((p) => p.costo > 0 && p.precio_venta > 0)
  let margenEje = 50
  if (conCosto.length > 0) {
    const avg =
      conCosto.reduce((acc, p) => acc + ((p.precio_venta - p.costo) / p.precio_venta) * 100, 0) / conCosto.length
    if (avg > 40) margenEje = 100
    else if (avg >= 20) margenEje = 60
    else margenEje = 20
  }

  const totalProd = input.productos.length
  const stockEje = totalProd === 0 ? 50 : clamp((input.productos.filter((p) => p.stock_actual > 0).length / totalProd) * 100)

  const totalV = input.ventas.length
  const clientesEje = totalV === 0 ? 50 : clamp((input.ventas.filter((v) => v.clienteId).length / totalV) * 100)

  const precioEje = ejePrecio(input.elasticidades)

  const ejesMap = { Ventas: ventasEje, Margen: margenEje, Stock: stockEje, Clientes: clientesEje, Precio: precioEje }
  const score =
    ventasEje * 0.25 + margenEje * 0.25 + stockEje * 0.2 + clientesEje * 0.15 + precioEje * 0.15
  const s = semaforo(score)
  return {
    ejes: (['Ventas', 'Margen', 'Stock', 'Clientes', 'Precio'] as const).map((eje) => ({
      eje,
      valor: Math.round(ejesMap[eje]),
      fullMark: 100,
    })),
    score: Math.round(score),
    etiqueta: s.etiqueta,
    color: s.color,
    bullets: bulletsSalud(ejesMap, score),
  }
}

export function calcularElasticidades(
  productos: ProductoFila[],
  historial: { productoId: string; precio: number; desde: string }[],
  ventas: VentaMini[],
  items: ItemMini[],
  hoy: string,
): FilaElasticidad[] {
  const porProd = new Map<string, { precio: number; desde: string }[]>()
  for (const h of historial) {
    const arr = porProd.get(h.productoId) ?? []
    arr.push(h)
    porProd.set(h.productoId, arr)
  }
  const fechaPorVenta = new Map(ventas.map((v) => [v.id, v.fechaIso]))
  const unidadesPorProdFecha = new Map<string, { fecha: string; cant: number }[]>()
  for (const it of items) {
    const fecha = fechaPorVenta.get(it.ventaId)
    if (!fecha) continue
    const arr = unidadesPorProdFecha.get(it.productoId) ?? []
    arr.push({ fecha, cant: it.cantidad })
    unidadesPorProdFecha.set(it.productoId, arr)
  }

  const nombres = new Map(productos.map((p) => [p.id, p.nombre]))
  const out: FilaElasticidad[] = []

  for (const [pid, hist] of porProd) {
    const uniq: { precio: number; desde: string }[] = []
    const orden = [...hist].sort((a, b) => a.desde.localeCompare(b.desde))
    for (const h of orden) {
      const last = uniq[uniq.length - 1]
      if (!last || Math.abs(last.precio - h.precio) > 0.009) uniq.push(h)
    }
    if (uniq.length < 2) continue
    const actual = uniq[uniq.length - 1]
    const anterior = uniq[uniq.length - 2]
    if (anterior.precio <= 0) continue
    const split = actual.desde
    const diasDesp = Math.max(1, Math.round((Date.parse(`${hoy}T12:00:00`) - Date.parse(`${split}T12:00:00`)) / 86_400_000) + 1)
    const desdeAnt = sumarDiasIso(split, -diasDesp)
    const hastaAnt = sumarDiasIso(split, -1)
    const movs = unidadesPorProdFecha.get(pid) ?? []
    let q1 = 0
    let q2 = 0
    for (const m of movs) {
      if (m.fecha >= split && m.fecha <= hoy) q2 += m.cant
      else if (m.fecha >= desdeAnt && m.fecha <= hastaAnt) q1 += m.cant
    }
    if (q1 <= 0) continue
    const dP = (actual.precio - anterior.precio) / anterior.precio
    if (Math.abs(dP) < 0.0001) continue
    const dQ = (q2 - q1) / q1
    const e = dQ / dP
    if (!Number.isFinite(e)) continue
    const inter = interpretarElasticidad(e)
    out.push({
      productoId: pid,
      producto: nombres.get(pid) ?? 'Producto',
      precioAnterior: anterior.precio,
      precioActual: actual.precio,
      deltaPrecioPct: dP * 100,
      deltaVentasPct: dQ * 100,
      elasticidad: e,
      ...inter,
    })
  }
  return out.sort((a, b) => a.producto.localeCompare(b.producto, 'es'))
}

export type PuntoSerieDia = { fecha: string; total: number }

function serieDiariaDe(ventas: VentaMini[], desde: string, hasta: string): PuntoSerieDia[] {
  const map = new Map<string, number>()
  for (const v of ventas) {
    if (v.fechaIso < desde || v.fechaIso > hasta) continue
    map.set(v.fechaIso, (map.get(v.fechaIso) ?? 0) + v.total)
  }
  const out: PuntoSerieDia[] = []
  for (let d = desde; d <= hasta; d = sumarDiasIso(d, 1)) {
    out.push({ fecha: d, total: map.get(d) ?? 0 })
  }
  return out
}

function agregarPorClave(serie: PuntoSerieDia[], claveDe: (fecha: string) => string): { clave: string; total: number }[] {
  const map = new Map<string, number>()
  for (const p of serie) {
    const k = claveDe(p.fecha)
    map.set(k, (map.get(k) ?? 0) + p.total)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([clave, total]) => ({ clave, total }))
}

export async function armarForecast(
  serieDiaria: PuntoSerieDia[],
  granularidad: GranularidadForecast,
  hoy: string,
  diasHistorial: number,
): Promise<InsightForecast | null> {
  let puntosReg: { clave: string; total: number }[]
  if (granularidad === 'dia') {
    puntosReg = serieDiaria
      .filter((p) => p.fecha >= sumarDiasIso(hoy, -29) && p.fecha <= hoy)
      .map((p) => ({ clave: p.fecha, total: p.total }))
  } else if (granularidad === 'semana') {
    puntosReg = agregarPorClave(
      serieDiaria.filter((p) => p.fecha >= sumarDiasIso(hoy, -89) && p.fecha <= hoy),
      lunesDe,
    )
  } else {
    puntosReg = agregarPorClave(
      serieDiaria.filter((p) => p.fecha >= inicioMesHace(hoy, 5) && p.fecha <= hoy),
      inicioMes,
    )
  }

  puntosReg.sort((a, b) => a.clave.localeCompare(b.clave))
  if (puntosReg.length < 2) return null

  const ss = await import('simple-statistics')
  const pares: [number, number][] = puntosReg.map((p, i) => [i, p.total])
  const reg = ss.linearRegression(pares)
  const linea = ss.linearRegressionLine(reg)

  const visible = puntosReg
  const offset = 0
  const labelDe =
    granularidad === 'dia' ? etiquetaDia : granularidad === 'semana' ? etiquetaDia : etiquetaMes

  const puntos: PuntoForecast[] = visible.map((p, i) => ({
    label: labelDe(p.clave),
    historico: p.total,
    proyeccion: i === visible.length - 1 ? p.total : null,
  }))

  const pasos = granularidad === 'dia' ? 14 : granularidad === 'semana' ? 4 : 3
  const stepIso = (clave: string, k: number) => {
    if (granularidad === 'dia') return sumarDiasIso(clave, k)
    if (granularidad === 'semana') return sumarDiasIso(clave, 7 * k)
    const [y, m] = clave.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1 + k, 1))
    return dt.toISOString().slice(0, 10)
  }

  let totalProyeccion = 0
  const lastClave = puntosReg[puntosReg.length - 1].clave
  for (let k = 1; k <= pasos; k++) {
    const x = puntosReg.length - 1 + k
    const y = Math.max(0, linea(x))
    totalProyeccion += y
    puntos.push({
      label: labelDe(stepIso(lastClave, k)),
      historico: null,
      proyeccion: y,
    })
  }

  const etiquetaProyeccion =
    granularidad === 'dia'
      ? 'Proyección próximos 14 días'
      : granularidad === 'semana'
        ? 'Proyección próximas 4 semanas'
        : 'Proyección próximos 3 meses'

  console.log('[insights forecast]', {
    granularidad,
    desde: puntosReg[0]?.clave,
    hasta: lastClave,
    puntosRegresion: puntosReg.length,
    offsetVisible: offset,
    primerTotal: puntosReg[0]?.total,
    ultimoTotal: puntosReg[puntosReg.length - 1]?.total,
    columna: 'fecha',
  })

  const tendencia: InsightForecast['tendencia'] = reg.m > 1 ? 'positiva' : reg.m < -1 ? 'negativa' : 'neutra'
  return { diasHistorial, puntos, totalProyeccion, tendencia, granularidad, etiquetaProyeccion }
}

export function preciosOptimos(
  productos: ProductoFila[],
  elasticidades: FilaElasticidad[],
  items: ItemMini[],
  ventas: VentaMini[],
  desdeMes: string,
): FilaPrecioOptimo[] {
  const idsMes = new Set(ventas.filter((v) => v.fechaIso >= desdeMes).map((v) => v.id))
  const udsMes = new Map<string, number>()
  for (const it of items) {
    if (!idsMes.has(it.ventaId)) continue
    udsMes.set(it.productoId, (udsMes.get(it.productoId) ?? 0) + it.cantidad)
  }
  const out: FilaPrecioOptimo[] = []
  for (const fila of elasticidades) {
    if (fila.elasticidad >= 0) continue
    const prod = productos.find((p) => p.id === fila.productoId)
    const costo = prod?.costo ?? 0
    if (costo <= 0) continue
    const denom = 1 + 1 / fila.elasticidad
    if (denom <= 0) continue
    const opt = costo / denom
    if (!Number.isFinite(opt) || opt <= fila.precioActual) continue
    const uds = udsMes.get(fila.productoId) ?? 0
    out.push({
      producto: fila.producto,
      precioActual: fila.precioActual,
      precioSugerido: opt,
      extraMes: (opt - fila.precioActual) * uds,
    })
  }
  return out
}

function armarVariantes(
  items: ItemMini[],
  ventas: VentaMini[],
  variantes: VarianteFila[],
  stock: Map<string, number>,
  hoy: string,
): InsightVariantes {
  const conVar = items.filter((i) => i.varianteId)
  if (conVar.length === 0) return { hayVentas: false, porAtributo: [], combinaciones: [], bullets: [] }

  const fechaV = new Map(ventas.map((v) => [v.id, v.fechaIso]))
  const varMap = new Map(variantes.map((v) => [v.id, v]))
  const desde30 = sumarDiasIso(hoy, -29)
  const desde60 = sumarDiasIso(hoy, -59)
  const hastaPrev = sumarDiasIso(desde30, -1)

  const attrTot = new Map<string, Map<string, number>>()
  const comboUds = new Map<string, { etiqueta: string; unidades: number; rec: number; ant: number; varId: string }>()
  let totalUds = 0

  for (const it of conVar) {
    const v = varMap.get(it.varianteId ?? '')
    if (!v) continue
    const fecha = fechaV.get(it.ventaId) ?? hoy
    totalUds += it.cantidad
    for (const [k, val] of Object.entries(v.atributos)) {
      if (!k || !val) continue
      const inner = attrTot.get(k) ?? new Map<string, number>()
      inner.set(val, (inner.get(val) ?? 0) + it.cantidad)
      attrTot.set(k, inner)
    }
    const etiqueta = etiquetaCombo(v.atributos) || 'Variante'
    const prev = comboUds.get(v.id) ?? { etiqueta, unidades: 0, rec: 0, ant: 0, varId: v.id }
    prev.unidades += it.cantidad
    if (fecha >= desde30) prev.rec += it.cantidad
    else if (fecha >= desde60 && fecha <= hastaPrev) prev.ant += it.cantidad
    comboUds.set(v.id, prev)
  }

  const porAtributo: DistAtributo[] = [...attrTot.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([atributo, vals]) => {
      const sum = [...vals.values()].reduce((a, b) => a + b, 0) || 1
      return {
        atributo,
        valores: [...vals.entries()]
          .map(([name, unidades]) => ({ name, unidades, pct: (unidades / sum) * 100 }))
          .sort((a, b) => b.unidades - a.unidades),
      }
    })

  const combinaciones: ComboVariante[] = [...comboUds.values()]
    .map((c) => {
      let tendencia: ComboVariante['tendencia'] = 'flat'
      if (c.rec > c.ant * 1.05) tendencia = 'up'
      else if (c.rec < c.ant * 0.95) tendencia = 'down'
      return {
        id: c.varId,
        etiqueta: c.etiqueta,
        unidades: c.unidades,
        pct: totalUds > 0 ? (c.unidades / totalUds) * 100 : 0,
        tendencia,
      }
    })
    .sort((a, b) => b.unidades - a.unidades)

  const bullets: string[] = []
  const top = combinaciones[0]
  if (top) {
    bullets.push(`🏆 Tu combinación más vendida es ${top.etiqueta} (${top.pct.toFixed(0)}%)`)
  }
  const floja = [...combinaciones].reverse().find((c) => c.unidades > 0 && c.pct < 5)
  if (floja && floja !== top) {
    bullets.push(`⚠️ ${floja.etiqueta} apenas vendió — considerá discontinuarla`)
  }
  const vendidas = new Set([...comboUds.keys()])
  const conStockSinVenta = variantes.find((v) => (stock.get(v.id) ?? 0) > 0 && !vendidas.has(v.id))
  if (conStockSinVenta) {
    bullets.push(`💡 Tenés stock de ${etiquetaCombo(conStockSinVenta.atributos) || 'una variante'} pero no la vendés`)
  }

  return { hayVentas: true, porAtributo, combinaciones: combinaciones.slice(0, 12), bullets }
}

export type InsightsErrores = {
  radar?: string
  elasticidad?: string
  forecast?: string
  variantes?: string
  precio?: string
}

export type InsightsPayload = {
  salud: InsightSalud | null
  elasticidades: FilaElasticidad[]
  forecast: InsightForecast | null
  serieDiaria: PuntoSerieDia[]
  diasHistorial: number
  variantes: InsightVariantes | null
  precios: FilaPrecioOptimo[]
  errores: InsightsErrores
}

export async function cargarInsights(
  client: SupabaseClient,
  usaVariantes: boolean,
): Promise<InsightsPayload> {
  const errores: InsightsErrores = {}
  const vacio: InsightsPayload = {
    salud: null,
    elasticidades: [],
    forecast: null,
    serieDiaria: [],
    diasHistorial: 0,
    variantes: null,
    precios: [],
    errores,
  }

  const hoy = fechaHoyAR()
  const mesIni = inicioMes(hoy)
  const mesAntIni = mesAnteriorDe(mesIni)
  const mesAntFin = sumarDiasIso(mesIni, -1)
  const desdeFetch = inicioMesHace(hoy, 5)

  let productos: ProductoFila[] = []
  let ventas: VentaMini[] = []
  let items: ItemMini[] = []
  let historial: { productoId: string; precio: number; desde: string }[] = []
  let diasHistorial = 0

  try {
    const [productosRes, ventasRes, historialRows, dias] = await Promise.all([
      listarProductos(client),
      cargarVentasRango(client, desdeFetch, hoy),
      paginar<Record<string, unknown>>(async (from, to) => {
        const res = await client
          .from('precios_historial')
          .select('producto_id, precio_venta, fecha_desde')
          .order('fecha_desde', { ascending: true })
          .range(from, to)
        return { data: (res.data ?? []) as Record<string, unknown>[], error: res.error }
      }),
      diasDesdePrimeraVenta(client, hoy),
    ])
    if (productosRes.error) throw new Error(productosRes.error)
    productos = productosRes.filas
    ventas = ventasRes.filter((v) => v.fechaIso >= desdeFetch && v.fechaIso <= hoy)
    ventas.sort((a, b) => a.fechaIso.localeCompare(b.fechaIso) || a.id.localeCompare(b.id))
    diasHistorial = dias
    historial = historialRows.map((r) => ({
      productoId: String(r.producto_id),
      precio: num(r.precio_venta),
      desde: String(r.fecha_desde ?? '').slice(0, 10),
    }))
    items = await cargarItems(client, ventas.map((v) => v.id))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudieron cargar los datos'
    errores.radar = msg
    errores.elasticidad = msg
    errores.forecast = msg
    errores.variantes = msg
    errores.precio = msg
    return vacio
  }

  let elasticidades: FilaElasticidad[] = []
  try {
    elasticidades = calcularElasticidades(productos, historial, ventas, items, hoy)
  } catch (e) {
    errores.elasticidad = e instanceof Error ? e.message : 'No se pudo calcular la elasticidad'
  }

  let salud: InsightSalud | null = null
  try {
    const ventasMes = ventas.filter((v) => v.fechaIso >= mesIni).reduce((a, v) => a + v.total, 0)
    const ventasMesAnt = ventas
      .filter((v) => v.fechaIso >= mesAntIni && v.fechaIso <= mesAntFin)
      .reduce((a, v) => a + v.total, 0)
    const hayMesAnterior = ventas.some((v) => v.fechaIso >= mesAntIni && v.fechaIso <= mesAntFin)
    salud = calcularSalud({
      ventasMes,
      ventasMesAnt,
      hayMesAnterior,
      productos,
      ventas,
      elasticidades,
    })
  } catch (e) {
    errores.radar = e instanceof Error ? e.message : 'No se pudo armar el radar'
  }

  const serieDiaria = serieDiariaDe(ventas, desdeFetch, hoy)

  let forecast: InsightForecast | null = null
  try {
    if (diasHistorial >= 30) {
      forecast = await armarForecast(serieDiaria, 'semana', hoy, diasHistorial)
    }
  } catch (e) {
    errores.forecast = e instanceof Error ? e.message : 'No se pudo calcular la proyección'
  }

  let variantes: InsightVariantes | null = null
  if (usaVariantes) {
    try {
      const vars = await listarVariantesDeProductos(
        client,
        productos.map((p) => p.id),
      )
      if (vars.error) throw new Error(vars.error)
      const ids = vars.filas.map((v) => v.id)
      const stock = new Map<string, number>()
      for (let i = 0; i < ids.length; i += 200) {
        const part = await stockPorVariante(client, ids.slice(i, i + 200))
        for (const [k, val] of part) stock.set(k, val)
      }
      const dist = armarVariantes(items, ventas, vars.filas, stock, hoy)
      variantes = dist.hayVentas ? dist : { hayVentas: false, porAtributo: [], combinaciones: [], bullets: [] }
    } catch (e) {
      errores.variantes = e instanceof Error ? e.message : 'No se pudo armar la distribución'
    }
  }

  let precios: FilaPrecioOptimo[] = []
  try {
    precios = preciosOptimos(productos, elasticidades, items, ventas, mesIni)
  } catch (e) {
    errores.precio = e instanceof Error ? e.message : 'No se pudo estimar el precio óptimo'
  }

  return { salud, elasticidades, forecast, serieDiaria, diasHistorial, variantes, precios, errores }
}
