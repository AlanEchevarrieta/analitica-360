import { useEffect, useMemo, useState } from 'react'
import { Card, Text } from '@tremor/react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { GraficoExpandible, SelectorChips } from '../components/GraficoExpandible'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { PlanesModal } from '../components/PlanesModal'
import {
  COLOR_CUADRANTE,
  cargarAnalyticsPeriodo,
  chartDiasSemanaDesdeRpc,
  colorFormaPago,
  contarVentasPeriodo,
  cuadranteProducto,
  formatoEjeCompacto,
  leerEmpresaIdAnalytics,
  LIMITE_ANALYTICS_VENTAS,
  margenPct,
  rangoPreset,
  ticketPromedio,
  truncarEtiqueta,
  variacionPct,
  ventasPorDiaSemana,
  type AnalyticsPeriodo,
  type AnalyticsProducto,
  type CuadranteProducto,
  type GranularidadEje,
  type PresetPeriodo,
} from '../lib/analytics'
import { exportarAnalyticsPdf } from '../lib/exportarReportes'
import { planTieneAnalytics } from '../lib/planes'
import { formatoARS, listarProductos } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'
import { obtenerConfiguracion } from '../lib/configuracion'
import {
  cargarAnalyticsVariantes,
  formatoRangoMargen,
  listarVariantesDeProductos,
  rangoMargenVariantes,
  type AnalyticsVariantes,
} from '../lib/variantes'
import { coloresGrafico, useTema } from '../lib/tema'
import {
  CHART_ACTIVE_BAR,
  CHART_BAR_BG,
  CHART_CURSOR_FILL,
  ChartTooltipBox,
  colorBarraMargen,
  TooltipEvolucion,
  TooltipFormaPago,
  TooltipMontoSimple,
  TooltipUnidades,
  TooltipTopProductos,
  asRechartsTooltip,
  useIndiceBarraActiva,
} from '../components/CustomTooltip'

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

const PRESETS: { id: PresetPeriodo; label: string }[] = [
  { id: 'semana', label: 'Última semana' },
  { id: 'mes', label: 'Último mes' },
  { id: 'tres_meses', label: 'Últimos 3 meses' },
  { id: 'anio', label: 'Último año' },
  { id: 'personalizado', label: 'Rango personalizado' },
]

type Columna = 'producto' | 'unidades' | 'total' | 'costo' | 'margen' | 'margen_pct' | 'rotacion'

function diasIncluidosPeriodo(desde: string, hasta: string) {
  const a = Date.parse(`${desde}T00:00:00`)
  const b = Date.parse(`${hasta}T00:00:00`)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1
  return Math.max(1, Math.round((b - a) / 86400000) + 1)
}

function rotacionUnidadesDia(unidades: number, dias: number) {
  return unidades / dias
}

const cardStyle = { borderColor: 'rgba(99,102,241,0.2)' }
const cardClass = 'analytics-card !rounded-lg !border !ring-0 !p-5'

function IconoKpi() {
  return (
    <svg className="h-8 w-8 text-[#6366F1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13h4v8H3v-8zm7-6h4v14h-4V7zm7 3h4v11h-4V10z" />
    </svg>
  )
}

function KpiShell({
  label,
  valor,
  detalle,
  detalleColor,
  wrap,
}: {
  label: string
  valor?: string
  detalle?: string
  detalleColor?: string
  wrap?: boolean
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid rgba(99,102,241,0.2)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium" style={{ color: 'var(--kpi-label)' }}>
            {label}
          </p>
          {valor ? (
            <p
              className={`mt-2 font-bold leading-tight ${
                wrap ? 'text-lg break-words' : 'whitespace-nowrap text-[24px]'
              }`}
              style={{ color: 'var(--kpi-value)' }}
            >
              {valor}
            </p>
          ) : null}
          {detalle ? (
            <p className="mt-1 text-xs leading-snug" style={{ color: detalleColor ?? 'var(--kpi-label)' }}>
              {detalle}
            </p>
          ) : null}
        </div>
        <div className="shrink-0">
          <IconoKpi />
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label,
  valor,
  pct,
}: {
  label: string
  valor: string
  pct: number
}) {
  const { tema } = useTema()
  const up = pct > 0.05
  const down = pct < -0.05
  const color = up
    ? tema === 'light'
      ? '#15803D'
      : '#4ADE80'
    : down
      ? tema === 'light'
        ? '#DC2626'
        : '#F87171'
      : tema === 'light'
        ? '#3730A3'
        : '#94A3B8'
  const flecha = up ? '↑' : down ? '↓' : '→'
  return (
    <KpiShell
      label={label}
      valor={valor}
      detalle={`${flecha} ${Math.abs(pct).toFixed(0)}% vs período anterior`}
      detalleColor={color}
    />
  )
}

function BarraMargen({ pct, etiqueta }: { pct: number; etiqueta?: string }) {
  const color = pct > 30 ? '#4ADE80' : pct >= 15 ? '#F59E0B' : '#F87171'
  const width = Math.max(0, Math.min(100, pct))
  return (
    <div className="min-w-[132px]">
      <p className="text-xs">{etiqueta ?? `${pct.toFixed(1)}%`}</p>
      <div className="mt-1 h-1.5 w-full rounded-full bg-white/10">
        <div className="h-1.5 rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  )
}

export function AnalyticsPage() {
  const { perfil } = useAuth()
  const { tema } = useTema()
  const g = coloresGrafico(tema)
  const [preset, setPreset] = useState<PresetPeriodo>('mes')
  const [desdeDraft, setDesdeDraft] = useState(() => rangoPreset('mes').desde)
  const [hastaDraft, setHastaDraft] = useState(() => rangoPreset('mes').hasta)
  const [desde, setDesde] = useState(() => rangoPreset('mes').desde)
  const [hasta, setHasta] = useState(() => rangoPreset('mes').hasta)
  const [data, setData] = useState<AnalyticsPeriodo>(VACIO)
  const [cargando, setCargando] = useState(true)
  const [orden, setOrden] = useState<{ col: Columna; dir: 'asc' | 'desc' }>({
    col: 'total',
    dir: 'desc',
  })
  const [modalPlanes, setModalPlanes] = useState(false)
  const [usaVariantes, setUsaVariantes] = useState(false)
  const [dataVar, setDataVar] = useState<AnalyticsVariantes | null>(null)
  const [rangosMargen, setRangosMargen] = useState<Map<string, { min: number; max: number }>>(
    new Map(),
  )
  const [avisoLimite, setAvisoLimite] = useState<number | null>(null)
  const [errorDebug, setErrorDebug] = useState<string | null>(null)
  const [granularidadEvo, setGranularidadEvo] = useState<GranularidadEje>('dia')
  const top10Hover = useIndiceBarraActiva()
  const diasHover = useIndiceBarraActiva()

  useEffect(() => {
    if (!perfil || !planTieneAnalytics(perfil.empresa.plan_actual)) {
      setCargando(false)
      return
    }
    setCargando(true)
    setErrorDebug(null)
    void (async () => {
      try {
        const client = requireSupabase()
        const empresaId = await leerEmpresaIdAnalytics(client, perfil.empresa.id)
        const conteo = await contarVentasPeriodo(client, desde, hasta, empresaId)
        if (conteo.error) setErrorDebug(conteo.error)
        const totalVentas = conteo.total
        if (totalVentas > LIMITE_ANALYTICS_VENTAS) {
          setAvisoLimite(totalVentas)
          setData(VACIO)
          setDataVar(null)
          setRangosMargen(new Map())
          return
        }
        setAvisoLimite(null)
        const [res, cfg] = await Promise.all([
          cargarAnalyticsPeriodo(client, desde, hasta, granularidadEvo, empresaId),
          obtenerConfiguracion(client, perfil.empresa.id),
        ])
        setData(res.data)
        if (res.error) setErrorDebug((prev) => (prev ? `${prev} · ${res.error}` : res.error))
        const usa = Boolean(cfg.config.usaVariantes)
        setUsaVariantes(usa)
        if (usa) {
          setDataVar(await cargarAnalyticsVariantes(client, desde, hasta, empresaId))
          const prods = await listarProductos(client)
          if (!prods.error && prods.filas.length > 0) {
            const vars = await listarVariantesDeProductos(
              client,
              prods.filas.map((p) => p.id),
            )
            const porProducto = new Map<string, typeof vars.filas>()
            for (const v of vars.filas) {
              const arr = porProducto.get(v.productoId) ?? []
              arr.push(v)
              porProducto.set(v.productoId, arr)
            }
            const rangos = new Map<string, { min: number; max: number }>()
            for (const p of prods.filas) {
              const rango = rangoMargenVariantes(porProducto.get(p.id) ?? [])
              if (rango) rangos.set(p.nombre, rango)
            }
            setRangosMargen(rangos)
          } else {
            setRangosMargen(new Map())
          }
        } else {
          setDataVar(null)
          setRangosMargen(new Map())
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        setErrorDebug((prev) => (prev ? `${prev} · ${msg}` : msg))
        setData(VACIO)
      } finally {
        setCargando(false)
      }
    })()
  }, [perfil, desde, hasta, granularidadEvo])

  const diasPeriodo = diasIncluidosPeriodo(desde, hasta)
  const dataPeriodoAnterior = useMemo(
    () => ({
      total: data.totalAnt,
      cantidad: data.cantidadAnt,
      costo: data.costoAnt,
      ticket: ticketPromedio(data.totalAnt, data.cantidadAnt),
      margen: margenPct(data.totalAnt, data.costoAnt),
    }),
    [data.totalAnt, data.cantidadAnt, data.costoAnt],
  )
  const comparacionPeriodo = useMemo(() => {
    const ticket = ticketPromedio(data.total, data.cantidad)
    const margen = margenPct(data.total, data.costo)
    const tieneCostos = data.costo > 0 || data.productos.some((p) => p.costo > 0)
    return {
      ticket,
      margen,
      tieneCostos,
      pctVentas: variacionPct(data.total, dataPeriodoAnterior.total),
      pctCantidad: variacionPct(data.cantidad, dataPeriodoAnterior.cantidad),
      pctTicket: variacionPct(ticket, dataPeriodoAnterior.ticket),
      pctMargen: variacionPct(margen, dataPeriodoAnterior.margen),
    }
  }, [data, dataPeriodoAnterior])
  const { ticket, margen, tieneCostos } = comparacionPeriodo

  const coloresDonut = useMemo(
    () => data.formasPago.map((f) => colorFormaPago(f.name)),
    [data.formasPago],
  )
  const totalPagos = useMemo(
    () => data.formasPago.reduce((acc, x) => acc + x.value, 0),
    [data.formasPago],
  )

  const donutData = useMemo(() => {
    const total = data.formasPago.reduce((acc, x) => acc + x.value, 0)
    return data.formasPago.map((f) => ({
      ...f,
      porcentaje: total > 0 ? (f.value / total) * 100 : 0,
    }))
  }, [data.formasPago])

  const tabla = useMemo(() => {
    const filas = [...data.productos]
    filas.sort((a, b) => {
      if (orden.col === 'rotacion') {
        const cmp = rotacionUnidadesDia(a.unidades, diasPeriodo) - rotacionUnidadesDia(b.unidades, diasPeriodo)
        return orden.dir === 'asc' ? cmp : -cmp
      }
      const va = a[orden.col]
      const vb = b[orden.col]
      const cmp = typeof va === 'string' ? va.localeCompare(String(vb), 'es') : Number(va) - Number(vb)
      return orden.dir === 'asc' ? cmp : -cmp
    })
    return filas
  }, [data.productos, orden, diasPeriodo])

  const matriz = useMemo(() => {
    const filas = data.productos.filter((p) => p.unidades > 0)
    if (filas.length === 0) return { puntos: [], avgU: 0, avgM: 0 }
    const avgU = filas.reduce((a, p) => a + p.unidades, 0) / filas.length
    const avgM = filas.reduce((a, p) => a + p.margen_pct, 0) / filas.length
    const puntos = filas.map((p) => {
      const cuad = cuadranteProducto(p.unidades, p.margen_pct, avgU, avgM)
      return {
        producto: p.producto,
        etiqueta: truncarEtiqueta(p.producto),
        unidades: p.unidades,
        margen_pct: p.margen_pct,
        cuadrante: cuad,
        color: COLOR_CUADRANTE[cuad],
      }
    })
    return { puntos, avgU, avgM }
  }, [data.productos])

  useEffect(() => {
    if (!data.dias_semana || data.dias_semana.length === 0) {
      console.log('[dias semana]', data?.dias_semana)
    }
  }, [data.dias_semana])

  const diasSemana = useMemo(() => {
    if (!data.dias_semana || data.dias_semana.length === 0) {
      return ventasPorDiaSemana(data.evolucionDiaria)
    }
    return chartDiasSemanaDesdeRpc(data.dias_semana)
  }, [data.dias_semana, data.evolucionDiaria])
  const evolucionVista = data.evolucion
  const top10Data = useMemo(() => {
    const porNombre = new Map(data.productos.map((p) => [p.producto, p]))
    return data.top10.map((p) => {
      const extra = porNombre.get(p.nombre)
      const tieneCosto = extra != null && extra.costo > 0
      return {
        ...p,
        etiqueta: truncarEtiqueta(p.nombre),
        total: extra?.total,
        margen_pct: extra?.margen_pct,
        tieneCosto,
        color: colorBarraMargen(extra?.margen_pct, tieneCosto),
      }
    })
  }, [data.top10, data.productos])

  if (!perfil) return null

  const desbloqueado = planTieneAnalytics(perfil.empresa.plan_actual)

  function aplicarFiltro() {
    const r = rangoPreset(preset, desdeDraft, hastaDraft)
    setDesde(r.desde)
    setHasta(r.hasta)
  }

  function elegirPreset(id: PresetPeriodo) {
    setPreset(id)
    if (id !== 'personalizado') {
      const r = rangoPreset(id)
      setDesdeDraft(r.desde)
      setHastaDraft(r.hasta)
    }
  }

  function ordenar(col: Columna) {
    setOrden((prev) =>
      prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'producto' ? 'asc' : 'desc' },
    )
  }

  function encabezado(col: Columna, label: string) {
    const activo = orden.col === col
    return (
      <button
        type="button"
        className="font-semibold uppercase tracking-wide"
        onClick={() => ordenar(col)}
      >
        {label}
        {activo ? (orden.dir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    )
  }

  return (
    <div
      className="relative min-h-dvh"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <ParticleNetwork />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 text-white">
        <AppNav />
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#A5B4FC]">Analítica 360</p>
            <h1 className="mt-1 text-xl font-bold">Analytics</h1>
          </div>
          {desbloqueado ? (
            <button
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[rgba(99,102,241,0.45)] px-4 text-sm font-semibold text-[#A5B4FC] hover:bg-white/5 disabled:opacity-50"
              type="button"
              disabled={cargando}
              onClick={() => {
                void exportarAnalyticsPdf({
                  empresa: perfil.empresa.nombre,
                  desde,
                  hasta,
                  data,
                }).catch(() => undefined)
              }}
            >
              Exportar reporte
            </button>
          ) : null}
        </div>

        {!desbloqueado ? (
          <div
            className="mx-auto max-w-lg rounded-lg px-6 py-10 text-center"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            <svg className="mx-auto h-10 w-10 text-[#A5B4FC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <p className="mt-4 text-lg font-semibold">Esta función está disponible en el Plan Pro.</p>
            <p className="mt-2 text-sm text-[#94A3B8]">
              Actualizá tu plan para acceder a análisis avanzados.
            </p>
            <button
              className="mt-6 h-11 rounded-md bg-[#6366F1] px-5 text-sm font-semibold text-white hover:bg-[#4F46E5]"
              type="button"
              onClick={() => setModalPlanes(true)}
            >
              Ver planes
            </button>
          </div>
        ) : (
          <>
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(99,102,241,0.2)',
              }}
            >
              <p className="text-xs font-medium text-[#94A3B8]">Período</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`rounded-md px-3 py-2 text-xs font-semibold ${
                      preset === p.id ? 'bg-[#6366F1] text-white' : 'bg-white/10 text-[#A5B4FC]'
                    }`}
                    onClick={() => elegirPreset(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {preset === 'personalizado' ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs text-[#94A3B8]">
                    Desde
                    <input
                      className="mt-1 h-10 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A]"
                      type="date"
                      value={desdeDraft}
                      onChange={(ev) => setDesdeDraft(ev.target.value)}
                    />
                  </label>
                  <label className="text-xs text-[#94A3B8]">
                    Hasta
                    <input
                      className="mt-1 h-10 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A]"
                      type="date"
                      value={hastaDraft}
                      onChange={(ev) => setHastaDraft(ev.target.value)}
                    />
                  </label>
                </div>
              ) : null}
              <button
                className="mt-4 h-10 rounded-md bg-[#6366F1] px-4 text-sm font-semibold text-white hover:bg-[#4F46E5]"
                type="button"
                onClick={aplicarFiltro}
              >
                Aplicar filtro
              </button>
            </div>

            {errorDebug ? (
              <pre className="mt-4 overflow-auto rounded-lg bg-red-950/80 px-3 py-3 text-left text-xs whitespace-pre-wrap text-red-100">
                {errorDebug}
              </pre>
            ) : null}

            {avisoLimite != null ? (
              <p className="mt-4 rounded-lg bg-amber-100 px-3 py-3 text-sm text-amber-950">
                Este período tiene {avisoLimite.toLocaleString('es-AR')} ventas — aplicá un filtro más
                acotado para ver los gráficos.
              </p>
            ) : null}

            {avisoLimite != null ? null : cargando ? (
              <p className="mt-8 text-sm text-[#94A3B8]">Cargando…</p>
            ) : (
              <>
                <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <Kpi label="Total ventas" valor={formatoARS(data.total)} pct={comparacionPeriodo.pctVentas} />
                  <Kpi
                    label="Transacciones"
                    valor={String(data.cantidad)}
                    pct={comparacionPeriodo.pctCantidad}
                  />
                  <Kpi label="Ticket promedio" valor={formatoARS(ticket)} pct={comparacionPeriodo.pctTicket} />
                  {tieneCostos ? (
                    <Kpi
                      label="Margen bruto estimado"
                      valor={`${margen.toFixed(1)}%`}
                      pct={comparacionPeriodo.pctMargen}
                    />
                  ) : (
                    <KpiShell
                      label="Margen bruto estimado"
                      detalle="Cargá el costo de tus productos para ver el margen"
                    />
                  )}
                </div>

                <Card className={`mt-8 ${cardClass}`} style={cardStyle}>
                  <GraficoExpandible
                    titulo={
                      granularidadEvo === 'dia'
                        ? 'Evolución de ventas diarias'
                        : granularidadEvo === 'semana'
                          ? 'Evolución de ventas semanales'
                          : 'Evolución de ventas mensuales'
                    }
                    compactoClass="h-72"
                    toolbar={
                      <SelectorChips
                        valor={granularidadEvo}
                        opciones={[
                          { id: 'dia', label: 'Día' },
                          { id: 'semana', label: 'Semana' },
                          { id: 'mes', label: 'Mes' },
                        ]}
                        onChange={setGranularidadEvo}
                      />
                    }
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={evolucionVista} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                        <CartesianGrid stroke={g.grilla} vertical={false} />
                        <XAxis
                          dataKey="fecha"
                          tick={{ fill: g.eje, fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: g.eje, fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={formatoEjeCompacto}
                          width={56}
                        />
                        <RechartsTooltip
                          cursor={{ fill: CHART_CURSOR_FILL }}
                          content={asRechartsTooltip(TooltipEvolucion)}
                        />
                        <Legend
                          wrapperStyle={{ color: g.eje, fontSize: 12 }}
                          formatter={(value) => String(value)}
                        />
                        <Area
                          type="monotone"
                          dataKey="Ventas"
                          name="Período actual"
                          stroke="#6366F1"
                          fill="rgba(99,102,241,0.2)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: '#6366F1' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Anterior"
                          name="Período anterior"
                          stroke="#94A3B8"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                          connectNulls
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </GraficoExpandible>
                </Card>

                <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Card className={cardClass} style={cardStyle}>
                    <GraficoExpandible titulo="Ventas por forma de pago" compactoClass="h-52">
                      {data.formasPago.length === 0 ? (
                        <p className="flex h-full items-center justify-center text-sm text-[#94A3B8]">
                          Sin ventas en el período
                        </p>
                      ) : (
                        <div className="relative h-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={donutData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius="72%"
                                outerRadius="100%"
                                paddingAngle={2}
                                stroke="rgba(15,27,45,0.9)"
                              >
                                {donutData.map((f, i) => (
                                  <Cell key={f.name} fill={coloresDonut[i]} />
                                ))}
                              </Pie>
                              <RechartsTooltip content={asRechartsTooltip(TooltipFormaPago)} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <p className="max-w-[40%] text-center text-xs font-semibold text-white">
                              {formatoARS(totalPagos)}
                            </p>
                          </div>
                        </div>
                      )}
                    </GraficoExpandible>
                    {data.formasPago.length > 0 ? (
                        <ul className="mt-5 space-y-2 text-xs text-[#94A3B8]">
                          {data.formasPago.map((f) => {
                            const pct = totalPagos > 0 ? (f.value / totalPagos) * 100 : 0
                            return (
                              <li key={f.name} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2">
                                  <span
                                    className="inline-block h-2.5 w-2.5 rounded-full"
                                    style={{ background: colorFormaPago(f.name) }}
                                  />
                                  {f.name}
                                </span>
                                <span>
                                  {formatoARS(f.value)} · {pct.toFixed(0)}%
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                    ) : null}
                  </Card>
                  <Card className={cardClass} style={cardStyle}>
                    <GraficoExpandible titulo="Top 10 productos más vendidos" compactoClass="h-[320px]">
                    {data.top10.length === 0 ? (
                      <p className="flex h-full items-center justify-center text-sm text-[#94A3B8]">Sin ventas en el período</p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={top10Data}
                            margin={{ top: 8, right: 40, left: 120, bottom: 0 }}
                            barCategoryGap="30%"
                            onMouseMove={top10Hover.onMouseMove as never}
                            onMouseLeave={top10Hover.onMouseLeave}
                          >
                            <CartesianGrid stroke={g.grilla} horizontal={false} />
                            <XAxis
                              type="number"
                              tick={{ fill: g.eje, fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              allowDecimals={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="etiqueta"
                              width={120}
                              tick={{ fill: g.eje, fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <RechartsTooltip
                              cursor={<Rectangle fill={CHART_CURSOR_FILL} />}
                              content={asRechartsTooltip(TooltipTopProductos)}
                            />
                            <Bar
                              dataKey="unidades"
                              radius={[0, 4, 4, 0]}
                              maxBarSize={18}
                              background={{ fill: CHART_BAR_BG }}
                              activeBar={<Rectangle fill={CHART_ACTIVE_BAR} />}
                            >
                              {top10Data.map((fila, i) => (
                                <Cell
                                  key={`${fila.nombre}-${i}`}
                                  fill={fila.color}
                                  fillOpacity={top10Hover.activo == null || top10Hover.activo === i ? 1 : 0.5}
                                />
                              ))}
                              <LabelList dataKey="unidades" position="right" fill="#94A3B8" fontSize={11} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                    )}
                    </GraficoExpandible>
                  </Card>
                </div>

                <Card className={`mt-8 ${cardClass}`} style={cardStyle}>
                  <Text className="!text-[#94A3B8]">Rendimiento por producto</Text>
                  {!tieneCostos ? (
                    <p className="mt-5 text-sm text-[#94A3B8]">
                      Cargá el costo de tus productos para ver el margen
                    </p>
                  ) : (
                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full min-w-[860px] text-left text-sm">
                        <thead className="text-xs text-[#94A3B8]">
                          <tr>
                            <th className="px-3 py-3">{encabezado('producto', 'Producto')}</th>
                            <th className="px-3 py-3">{encabezado('unidades', 'Unidades vendidas')}</th>
                            <th className="px-3 py-3">{encabezado('rotacion', 'Rotación')}</th>
                            <th className="px-3 py-3">{encabezado('total', 'Total $')}</th>
                            <th className="px-3 py-3">{encabezado('costo', 'Costo total')}</th>
                            <th className="px-3 py-3">{encabezado('margen', 'Margen $')}</th>
                            <th className="px-3 py-3">{encabezado('margen_pct', 'Margen %')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tabla.map((fila: AnalyticsProducto) => {
                            const rango = rangosMargen.get(fila.producto)
                            const pctBarra = rango ? (rango.min + rango.max) / 2 : fila.margen_pct
                            return (
                            <tr key={fila.producto} className="border-t border-white/10">
                              <td className="px-3 py-3 font-medium">{fila.producto}</td>
                              <td className="px-3 py-3">{fila.unidades}</td>
                              <td className="px-3 py-3">
                                {rotacionUnidadesDia(fila.unidades, diasPeriodo).toFixed(1)} u/día
                              </td>
                              <td className="px-3 py-3">{formatoARS(fila.total)}</td>
                              <td className="px-3 py-3">{formatoARS(fila.costo)}</td>
                              <td className="px-3 py-3">{formatoARS(fila.margen)}</td>
                              <td className="px-3 py-3">
                                <BarraMargen
                                  pct={pctBarra}
                                  etiqueta={rango ? formatoRangoMargen(rango) : undefined}
                                />
                              </td>
                            </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                <Card className={`mt-8 ${cardClass}`} style={cardStyle}>
                  <GraficoExpandible titulo="Matriz de productos — Rotación vs Rentabilidad" compactoClass="h-[360px]">
                  {matriz.puntos.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-sm text-[#94A3B8]">Sin ventas en el período</p>
                  ) : (
                      <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                            <CartesianGrid stroke={g.grilla} />
                            <XAxis
                              type="number"
                              dataKey="unidades"
                              name="Rotación"
                              tick={{ fill: g.eje, fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              allowDecimals={false}
                              label={{ value: 'Rotación (unidades)', fill: g.eje, fontSize: 11, position: 'insideBottom', offset: -4 }}
                            />
                            <YAxis
                              type="number"
                              dataKey="margen_pct"
                              name="Margen"
                              tick={{ fill: g.eje, fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              unit="%"
                              label={{ value: 'Margen %', fill: g.eje, fontSize: 11, angle: -90, position: 'insideLeft' }}
                            />
                            <ReferenceLine x={matriz.avgU} stroke={g.eje} strokeDasharray="4 4" />
                            <ReferenceLine y={matriz.avgM} stroke={g.eje} strokeDasharray="4 4" />
                            <RechartsTooltip
                              cursor={{ strokeDasharray: '3 3' }}
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null
                                const p = payload[0].payload as {
                                  producto: string
                                  margen_pct: number
                                  unidades: number
                                  cuadrante: CuadranteProducto
                                }
                                return (
                                  <ChartTooltipBox>
                                    <p style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600 }}>{p.producto}</p>
                                    <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 6 }}>
                                      Margen: {p.margen_pct.toFixed(1)}%
                                    </p>
                                    <p style={{ color: '#94A3B8', fontSize: 12 }}>Unidades vendidas: {p.unidades}</p>
                                    <p
                                      style={{
                                        color: COLOR_CUADRANTE[p.cuadrante],
                                        fontSize: 12,
                                        marginTop: 4,
                                        fontWeight: 600,
                                      }}
                                    >
                                      Cuadrante: {p.cuadrante}
                                    </p>
                                  </ChartTooltipBox>
                                )
                              }}
                            />
                            <Scatter data={matriz.puntos} name="Productos">
                              {matriz.puntos.map((p) => (
                                <Cell key={p.producto} fill={p.color} />
                              ))}
                              <LabelList dataKey="etiqueta" position="top" fill={g.eje} fontSize={10} />
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                  )}
                  </GraficoExpandible>
                  {matriz.puntos.length > 0 ? (
                      <ul className="mt-4 flex flex-wrap gap-4 text-xs text-[#94A3B8]">
                        {(Object.keys(COLOR_CUADRANTE) as CuadranteProducto[]).map((c) => (
                          <li key={c} className="flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR_CUADRANTE[c] }} />
                            {c}
                          </li>
                        ))}
                      </ul>
                  ) : null}
                </Card>

                <Card className={`mt-8 ${cardClass}`} style={cardStyle}>
                  <GraficoExpandible titulo="¿Qué días vendés más?" compactoClass="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={diasSemana}
                        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                        onMouseMove={diasHover.onMouseMove as never}
                        onMouseLeave={diasHover.onMouseLeave}
                      >
                        <CartesianGrid stroke={g.grilla} vertical={false} />
                        <XAxis dataKey="dia" tick={{ fill: g.eje, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fill: g.eje, fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={formatoEjeCompacto}
                          width={56}
                        />
                        <RechartsTooltip
                          cursor={<Rectangle fill={CHART_CURSOR_FILL} />}
                          content={asRechartsTooltip(TooltipMontoSimple)}
                        />
                        <Bar
                          dataKey="total"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={36}
                          background={{ fill: CHART_BAR_BG }}
                          activeBar={<Rectangle fill={CHART_ACTIVE_BAR} radius={4} />}
                        >
                          {diasSemana.map((d, i) => (
                            <Cell
                              key={d.dia}
                              fill={d.destacado ? '#4ADE80' : '#6366F1'}
                              fillOpacity={
                                diasHover.activo == null
                                  ? d.destacado
                                    ? 1
                                    : 0.45
                                  : diasHover.activo === i
                                    ? 1
                                    : 0.5
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </GraficoExpandible>
                </Card>

                {usaVariantes && dataVar ? (
                  <Card className={`mt-8 ${cardClass}`} style={cardStyle}>
                    <Text className="!text-[#94A3B8]">Análisis de variantes</Text>
                    {dataVar.insightCombo ? (
                      <p className="mt-3 text-sm text-[#F1F5F9]">
                        Tu combinación más vendida es {dataVar.insightCombo} ({dataVar.insightPct}%)
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-[#94A3B8]">Todavía no hay ventas con variantes en el período.</p>
                    )}
                    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <div style={{ height: 240 }}>
                        <p className="mb-2 text-xs text-[#94A3B8]">Ventas por color</p>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dataVar.porColor} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                            <CartesianGrid stroke={g.grilla} vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: g.eje, fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: g.eje, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <RechartsTooltip cursor={<Rectangle fill={CHART_CURSOR_FILL} />} content={asRechartsTooltip(TooltipUnidades)} />
                            <Bar dataKey="unidades" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={36} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ height: 240 }}>
                        <p className="mb-2 text-xs text-[#94A3B8]">Ventas por talle</p>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dataVar.porTalle} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                            <CartesianGrid stroke={g.grilla} vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: g.eje, fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: g.eje, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <RechartsTooltip cursor={<Rectangle fill={CHART_CURSOR_FILL} />} content={asRechartsTooltip(TooltipUnidades)} />
                            <Bar dataKey="unidades" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    {dataVar.combinaciones.length > 0 ? (
                      <div className="mt-6 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="text-xs text-[#94A3B8]">
                            <tr>
                              <th className="px-3 py-2">Producto</th>
                              <th className="px-3 py-2">Combinación</th>
                              <th className="px-3 py-2">Unidades</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dataVar.combinaciones.slice(0, 20).map((c) => (
                              <tr key={`${c.producto}-${c.combo}`} className="border-t border-white/10">
                                <td className="px-3 py-2">{c.producto}</td>
                                <td className="px-3 py-2">{c.combo}</td>
                                <td className="px-3 py-2">{c.unidades}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </Card>
                ) : null}

                {data.clientes.hay ? (
                  <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiShell
                      label="Clientes activos"
                      valor={String(data.clientes.activos)}
                      detalle="Compraron en el período"
                    />
                    <KpiShell
                      label="Ticket promedio por cliente"
                      valor={formatoARS(data.clientes.ticket)}
                    />
                    <KpiShell
                      label="Cliente que más gastó"
                      valor={data.clientes.topNombre || '—'}
                      wrap
                      detalle={formatoARS(data.clientes.topTotal)}
                      detalleColor={tema === 'light' ? '#15803D' : '#4ADE80'}
                    />
                    <KpiShell
                      label="Nuevos vs recurrentes"
                      valor={`${data.clientes.pctNuevos.toFixed(0)}% / ${data.clientes.pctRecurrentes.toFixed(0)}%`}
                      detalle="nuevos · recurrentes"
                    />
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
      <PlanesModal abierto={modalPlanes} onCerrar={() => setModalPlanes(false)} />
    </div>
  )
}
