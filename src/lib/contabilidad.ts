import type { SupabaseClient } from '@supabase/supabase-js'
import { fechaHoyAR, fechaIsoDe, inicioMesIso, sumarDiasIso } from './analytics'
import { listarGastos, type GastoFila } from './gastos'
import { listarProductos } from './productos'

export type PresetContabilidad = 'mes' | 'mes_ant' | 'trimestre' | 'anio' | 'personalizado'

export type TotalesPeriodo = {
  ingresos: number
  cogs: number
  gastos: number
  neto: number
  cantidadVentas: number
}

export type PuntoMes = {
  clave: string
  label: string
  ingresos: number
  cogs: number
  gastos: number
  resultado: number
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function ultimoDiaMes(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function rangoContabilidad(
  preset: PresetContabilidad,
  desde?: string,
  hasta?: string,
): { desde: string; hasta: string } {
  const hoy = fechaHoyAR()
  if (preset === 'personalizado') {
    return { desde: desde || inicioMesIso(hoy), hasta: hasta || hoy }
  }
  const [y, m] = hoy.split('-').map(Number)
  if (preset === 'mes') return { desde: inicioMesIso(hoy), hasta: hoy }
  if (preset === 'mes_ant') {
    const py = m === 1 ? y - 1 : y
    const pm = m === 1 ? 12 : m - 1
    const d = String(py).padStart(4, '0') + '-' + String(pm).padStart(2, '0')
    return { desde: `${d}-01`, hasta: `${d}-${String(ultimoDiaMes(py, pm)).padStart(2, '0')}` }
  }
  if (preset === 'trimestre') {
    const q = Math.floor((m - 1) / 3)
    const startM = q * 3 + 1
    const desdeIso = `${y}-${String(startM).padStart(2, '0')}-01`
    return { desde: desdeIso, hasta: hoy }
  }
  return { desde: `${y}-01-01`, hasta: hoy }
}

export function mesesAtras(hoy: string, cantidad: number): string[] {
  const [y, m] = hoy.split('-').map(Number)
  const out: string[] = []
  for (let i = cantidad - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1 - i, 1))
    out.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function labelMesClave(clave: string) {
  const [y, m] = clave.split('-').map(Number)
  if (!y || !m) return clave
  const txt = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
  return txt.replace('.', '')
}

function finDeMesClave(clave: string, tope: string) {
  const [y, m] = clave.split('-').map(Number)
  const fin = `${clave}-${String(ultimoDiaMes(y, m)).padStart(2, '0')}`
  return fin > tope ? tope : fin
}

async function ventasConItems(
  client: SupabaseClient,
  empresaId: string,
  desde: string,
  hasta: string,
): Promise<{
  ventas: { id: string; fecha: string; total: number }[]
  items: { venta_id: string; cogs: number }[]
  error: string | null
}> {
  const ventas: { id: string; fecha: string; total: number }[] = []
  const PAGE = 1000
  let from = 0
  for (;;) {
    const { data, error } = await client
      .from('ventas')
      .select('id, fecha, total_con_interes')
      .eq('empresa_id', empresaId)
      .is('deleted_at', null)
      .gte('fecha', `${desde}T00:00:00-03:00`)
      .lt('fecha', `${sumarDiasIso(hasta, 1)}T00:00:00-03:00`)
      .range(from, from + PAGE - 1)
    if (error) return { ventas: [], items: [], error: error.message }
    const chunk = (data ?? []) as Record<string, unknown>[]
    for (const row of chunk) {
      const iso = fechaIsoDe(row.fecha)
      if (!iso) continue
      ventas.push({ id: String(row.id), fecha: iso, total: num(row.total_con_interes) })
    }
    if (chunk.length < PAGE) break
    from += PAGE
    if (from > 80_000) break
  }
  const items: { venta_id: string; cogs: number }[] = []
  const ids = ventas.map((v) => v.id)
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200)
    if (slice.length === 0) continue
    const { data, error } = await client
      .from('ventas_items')
      .select('venta_id, cantidad, costo_unitario')
      .in('venta_id', slice)
    if (error) return { ventas, items: [], error: error.message }
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      items.push({
        venta_id: String(row.venta_id),
        cogs: num(row.cantidad) * num(row.costo_unitario),
      })
    }
  }
  return { ventas, items, error: null }
}

export function sumarPeriodo(
  ventas: { id: string; fecha: string; total: number }[],
  items: { venta_id: string; cogs: number }[],
  gastos: GastoFila[],
  desde: string,
  hasta: string,
): TotalesPeriodo {
  const enRango = (iso: string) => iso >= desde && iso <= hasta
  const ventasP = ventas.filter((v) => enRango(v.fecha))
  const ids = new Set(ventasP.map((v) => v.id))
  const ingresos = ventasP.reduce((a, v) => a + v.total, 0)
  const cogs = items.filter((i) => ids.has(i.venta_id)).reduce((a, i) => a + i.cogs, 0)
  const g = gastos.filter((x) => enRango(x.fecha)).reduce((a, x) => a + x.monto, 0)
  return {
    ingresos,
    cogs,
    gastos: g,
    neto: ingresos - cogs - g,
    cantidadVentas: ventasP.length,
  }
}

export function serieMensual(
  claves: string[],
  ventas: { id: string; fecha: string; total: number }[],
  items: { venta_id: string; cogs: number }[],
  gastos: GastoFila[],
): PuntoMes[] {
  const cogsPorVenta = new Map<string, number>()
  for (const it of items) {
    cogsPorVenta.set(it.venta_id, (cogsPorVenta.get(it.venta_id) ?? 0) + it.cogs)
  }
  return claves.map((clave) => {
    const ventasM = ventas.filter((v) => v.fecha.startsWith(clave))
    const ingresos = ventasM.reduce((a, v) => a + v.total, 0)
    const cogs = ventasM.reduce((a, v) => a + (cogsPorVenta.get(v.id) ?? 0), 0)
    const g = gastos.filter((x) => x.fecha.startsWith(clave)).reduce((a, x) => a + x.monto, 0)
    return {
      clave,
      label: labelMesClave(clave),
      ingresos,
      cogs,
      gastos: g,
      resultado: ingresos - cogs - g,
    }
  })
}

export async function cargarContabilidad(
  client: SupabaseClient,
  empresaId: string,
  periodo: { desde: string; hasta: string },
): Promise<{
  totales: TotalesPeriodo
  serie6: PuntoMes[]
  gastosPeriodo: GastoFila[]
  valorInventario: number
  error: string | null
}> {
  const hoy = fechaHoyAR()
  const claves6 = mesesAtras(hoy, 6)
  const desdeHist = `${claves6[0]}-01`
  const hastaHist = hoy
  const [ventasRes, gastosHist, productos] = await Promise.all([
    ventasConItems(client, empresaId, desdeHist, hastaHist),
    listarGastos(client, { empresaId, desde: desdeHist, hasta: hastaHist }),
    listarProductos(client),
  ])
  const error = ventasRes.error || gastosHist.error || productos.error
  const valorInventario = productos.filas.reduce((a, p) => a + p.stock_actual * p.costo, 0)
  const serie6 = serieMensual(claves6, ventasRes.ventas, ventasRes.items, gastosHist.filas)
  const totales = sumarPeriodo(
    ventasRes.ventas,
    ventasRes.items,
    gastosHist.filas,
    periodo.desde,
    periodo.hasta,
  )
  const gastosPeriodo = gastosHist.filas.filter((g) => g.fecha >= periodo.desde && g.fecha <= periodo.hasta)
  return { totales, serie6, gastosPeriodo, valorInventario, error }
}

export function ratiosFinancieros(input: {
  ingresos: number
  cogs: number
  gastos: number
  cantidadVentas: number
  valorInventario: number
  gastosFijos: number
}) {
  const { ingresos, cogs, gastos, cantidadVentas, valorInventario, gastosFijos } = input
  const margenBrutoPct = ingresos > 0 ? ((ingresos - cogs) / ingresos) * 100 : 0
  const neto = ingresos - cogs - gastos
  const margenNetoPct = ingresos > 0 ? (neto / ingresos) * 100 : 0
  const mbFrac = margenBrutoPct / 100
  const puntoEquilibrio = mbFrac > 0 ? gastosFijos / mbFrac : 0
  const invertido = cogs + gastos
  const roiPct = invertido > 0 ? (neto / invertido) * 100 : 0
  const cogsDia = cogs / 30
  const diasInventario = cogsDia > 0 ? valorInventario / cogsDia : 0
  const ticket = cantidadVentas > 0 ? ingresos / cantidadVentas : 0
  return {
    margenBrutoPct,
    margenNetoPct,
    puntoEquilibrio,
    roiPct,
    diasInventario,
    ticket,
    neto,
  }
}

export function semaforoMargenBruto(pct: number): 'verde' | 'amarillo' | 'rojo' {
  if (pct > 50) return 'verde'
  if (pct >= 30) return 'amarillo'
  return 'rojo'
}

export function semaforoMargenNeto(pct: number): 'verde' | 'amarillo' | 'rojo' {
  if (pct > 20) return 'verde'
  if (pct >= 10) return 'amarillo'
  return 'rojo'
}

export function proyectarFlujo(serie6: PuntoMes[], meses = 3) {
  const ult3 = serie6.slice(-3)
  const avgIng = ult3.length ? ult3.reduce((a, p) => a + p.ingresos, 0) / ult3.length : 0
  const avgCogs = ult3.length ? ult3.reduce((a, p) => a + p.cogs, 0) / ult3.length : 0
  const avgGas = ult3.length ? ult3.reduce((a, p) => a + p.gastos, 0) / ult3.length : 0
  const avgRes = avgIng - avgCogs - avgGas
  const hoy = fechaHoyAR()
  const [y, m] = hoy.split('-').map(Number)
  const extra: PuntoMes[] = []
  for (let k = 1; k <= meses; k++) {
    const dt = new Date(Date.UTC(y, m - 1 + k, 1))
    const clave = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
    extra.push({
      clave,
      label: labelMesClave(clave),
      ingresos: avgIng,
      cogs: avgCogs,
      gastos: avgGas,
      resultado: avgRes,
    })
  }
  return extra
}

export function acumuladoSerie(puntos: PuntoMes[]) {
  let acc = 0
  return puntos.map((p) => {
    acc += p.resultado
    return { ...p, acumulado: acc }
  })
}

export function rangoMesCompleto(clave: string, topeHoy: string) {
  return { desde: `${clave}-01`, hasta: finDeMesClave(clave, topeHoy) }
}
