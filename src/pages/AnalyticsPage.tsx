import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Card, Text } from '@tremor/react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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
import { ParticleNetwork } from '../components/ParticleNetwork'
import { PlanesModal } from '../components/PlanesModal'
import {
  COLOR_CUADRANTE,
  cargarAnalyticsPeriodo,
  colorFormaPago,
  cuadranteProducto,
  fechaExactaLarga,
  formatoEjeCompacto,
  margenPct,
  rangoPreset,
  ticketPromedio,
  truncarEtiqueta,
  variacionPct,
  ventasPorDiaSemana,
  type AnalyticsPeriodo,
  type AnalyticsProducto,
  type CuadranteProducto,
  type PresetPeriodo,
} from '../lib/analytics'
import { exportarAnalyticsPdf } from '../lib/exportarReportes'
import { planTieneAnalytics } from '../lib/planes'
import { formatoARS } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'
import { coloresGrafico, useTema } from '../lib/tema'

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

const PRESETS: { id: PresetPeriodo; label: string }[] = [
  { id: 'semana', label: 'Última semana' },
  { id: 'mes', label: 'Último mes' },
  { id: 'tres_meses', label: 'Últimos 3 meses' },
  { id: 'anio', label: 'Último año' },
  { id: 'personalizado', label: 'Rango personalizado' },
]

type Columna = 'producto' | 'unidades' | 'total' | 'costo' | 'margen' | 'margen_pct'

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

function TooltipVentas({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value?: unknown; payload?: { fechaExacta?: string } }[]
  label?: unknown
}) {
  if (!active || !payload?.length) return null
  const iso = payload[0]?.payload?.fechaExacta
  const fecha = iso ? fechaExactaLarga(iso) : String(label ?? '')
  return (
    <div className="chart-tooltip">
      <p style={{ color: 'var(--text-muted)' }}>{fecha}</p>
      <p className="mt-1 font-semibold">{formatoARS(Number(payload[0].value ?? 0))}</p>
    </div>
  )
}

function BarraMargen({ pct }: { pct: number }) {
  const color = pct > 30 ? '#4ADE80' : pct >= 15 ? '#F59E0B' : '#F87171'
  const width = Math.max(0, Math.min(100, pct))
  return (
    <div className="min-w-[132px]">
      <p className="text-xs">{pct.toFixed(1)}%</p>
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

  useEffect(() => {
    if (!perfil || !planTieneAnalytics(perfil.empresa.plan_actual)) {
      setCargando(false)
      return
    }
    setCargando(true)
    void cargarAnalyticsPeriodo(requireSupabase(), desde, hasta).then((fila) => {
      setData(fila)
      setCargando(false)
    })
  }, [perfil, desde, hasta])

  const tieneCostos = data.costo > 0 || data.productos.some((p) => p.costo > 0)
  const ticket = ticketPromedio(data.total, data.cantidad)
  const ticketAnt = ticketPromedio(data.totalAnt, data.cantidadAnt)
  const margen = margenPct(data.total, data.costo)
  const margenAnt = margenPct(data.totalAnt, data.costoAnt)

  const coloresDonut = useMemo(
    () => data.formasPago.map((f) => colorFormaPago(f.name)),
    [data.formasPago],
  )
  const totalPagos = useMemo(
    () => data.formasPago.reduce((acc, x) => acc + x.value, 0),
    [data.formasPago],
  )

  const tabla = useMemo(() => {
    const filas = [...data.productos]
    filas.sort((a, b) => {
      const va = a[orden.col]
      const vb = b[orden.col]
      const cmp = typeof va === 'string' ? va.localeCompare(String(vb), 'es') : Number(va) - Number(vb)
      return orden.dir === 'asc' ? cmp : -cmp
    })
    return filas
  }, [data.productos, orden])

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

  const diasSemana = useMemo(() => ventasPorDiaSemana(data.evolucion), [data.evolucion])
  const top10Data = useMemo(
    () => data.top10.map((p) => ({ ...p, etiqueta: truncarEtiqueta(p.nombre) })),
    [data.top10],
  )

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

            {cargando ? (
              <p className="mt-8 text-sm text-[#94A3B8]">Cargando…</p>
            ) : (
              <>
                <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <Kpi label="Total ventas" valor={formatoARS(data.total)} pct={variacionPct(data.total, data.totalAnt)} />
                  <Kpi
                    label="Transacciones"
                    valor={String(data.cantidad)}
                    pct={variacionPct(data.cantidad, data.cantidadAnt)}
                  />
                  <Kpi label="Ticket promedio" valor={formatoARS(ticket)} pct={variacionPct(ticket, ticketAnt)} />
                  {tieneCostos ? (
                    <Kpi
                      label="Margen bruto estimado"
                      valor={`${margen.toFixed(1)}%`}
                      pct={variacionPct(margen, margenAnt)}
                    />
                  ) : (
                    <KpiShell
                      label="Margen bruto estimado"
                      detalle="Cargá el costo de tus productos para ver el margen"
                    />
                  )}
                </div>

                <Card className={`mt-8 ${cardClass}`} style={cardStyle}>
                  <Text className="!text-[#94A3B8]">Evolución de ventas diarias</Text>
                  <AreaChart
                    className="mt-6 h-72"
                    data={data.evolucion}
                    index="fecha"
                    categories={['Ventas']}
                    colors={['indigo']}
                    valueFormatter={formatoEjeCompacto}
                    customTooltip={TooltipVentas as never}
                    yAxisWidth={56}
                    showLegend={false}
                    showTooltip
                  />
                </Card>

                <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Card className={cardClass} style={cardStyle}>
                    <Text className="!text-[#94A3B8]">Ventas por forma de pago</Text>
                    {data.formasPago.length === 0 ? (
                      <p className="mt-8 text-center text-sm text-[#94A3B8]">Sin ventas en el período</p>
                    ) : (
                      <>
                        <div className="relative mt-6 h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={data.formasPago}
                                dataKey="value"
                                nameKey="name"
                                innerRadius="72%"
                                outerRadius="100%"
                                paddingAngle={2}
                                stroke="rgba(15,27,45,0.9)"
                              >
                                {data.formasPago.map((f, i) => (
                                  <Cell key={f.name} fill={coloresDonut[i]} />
                                ))}
                              </Pie>
                              <RechartsTooltip
                                formatter={(value) => formatoARS(Number(value ?? 0))}
                                contentStyle={{
                                  background: g.tooltipBg,
                                  border: `1px solid ${g.tooltipBorder}`,
                                  borderRadius: 8,
                                  color: g.tooltipFg,
                                  fontSize: 12,
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <p className="max-w-[40%] text-center text-xs font-semibold text-white">
                              {formatoARS(totalPagos)}
                            </p>
                          </div>
                        </div>
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
                      </>
                    )}
                  </Card>
                  <Card className={cardClass} style={cardStyle}>
                    <Text className="!text-[#94A3B8]">Top 10 productos más vendidos</Text>
                    {data.top10.length === 0 ? (
                      <p className="mt-8 text-center text-sm text-[#94A3B8]">Sin ventas en el período</p>
                    ) : (
                      <div className="mt-4" style={{ height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={top10Data}
                            margin={{ top: 8, right: 40, left: 120, bottom: 0 }}
                            barCategoryGap="30%"
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
                              formatter={(value) => [`${Number(value ?? 0)} u.`, 'Unidades']}
                              contentStyle={{
                                background: g.tooltipBg,
                                border: `1px solid ${g.tooltipBorder}`,
                                borderRadius: 8,
                                color: g.tooltipFg,
                                fontSize: 12,
                              }}
                            />
                            <Bar dataKey="unidades" fill="#4ADE80" radius={[0, 4, 4, 0]} maxBarSize={18}>
                              <LabelList dataKey="unidades" position="right" fill="#4ADE80" fontSize={11} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
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
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="text-xs text-[#94A3B8]">
                          <tr>
                            <th className="px-3 py-3">{encabezado('producto', 'Producto')}</th>
                            <th className="px-3 py-3">{encabezado('unidades', 'Unidades vendidas')}</th>
                            <th className="px-3 py-3">{encabezado('total', 'Total $')}</th>
                            <th className="px-3 py-3">{encabezado('costo', 'Costo total')}</th>
                            <th className="px-3 py-3">{encabezado('margen', 'Margen $')}</th>
                            <th className="px-3 py-3">{encabezado('margen_pct', 'Margen %')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tabla.map((fila: AnalyticsProducto) => (
                            <tr key={fila.producto} className="border-t border-white/10">
                              <td className="px-3 py-3 font-medium">{fila.producto}</td>
                              <td className="px-3 py-3">{fila.unidades}</td>
                              <td className="px-3 py-3">{formatoARS(fila.total)}</td>
                              <td className="px-3 py-3">{formatoARS(fila.costo)}</td>
                              <td className="px-3 py-3">{formatoARS(fila.margen)}</td>
                              <td className="px-3 py-3">
                                <BarraMargen pct={fila.margen_pct} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                <Card className={`mt-8 ${cardClass}`} style={cardStyle}>
                  <Text className="!text-[#94A3B8]">Matriz de productos — Rotación vs Rentabilidad</Text>
                  {matriz.puntos.length === 0 ? (
                    <p className="mt-8 text-center text-sm text-[#94A3B8]">Sin ventas en el período</p>
                  ) : (
                    <>
                      <div className="mt-4" style={{ height: 360 }}>
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
                                  <div className="chart-tooltip">
                                    <p className="font-semibold">{p.producto}</p>
                                    <p className="mt-1">Margen: {p.margen_pct.toFixed(1)}%</p>
                                    <p>Unidades vendidas: {p.unidades}</p>
                                    <p className="mt-1" style={{ color: COLOR_CUADRANTE[p.cuadrante] }}>
                                      Cuadrante: {p.cuadrante}
                                    </p>
                                  </div>
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
                      </div>
                      <ul className="mt-4 flex flex-wrap gap-4 text-xs text-[#94A3B8]">
                        {(Object.keys(COLOR_CUADRANTE) as CuadranteProducto[]).map((c) => (
                          <li key={c} className="flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR_CUADRANTE[c] }} />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Card>

                <Card className={`mt-8 ${cardClass}`} style={cardStyle}>
                  <Text className="!text-[#94A3B8]">Tendencia de ventas</Text>
                  <div className="mt-4" style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.evolucion} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid stroke={g.grilla} vertical={false} />
                        <XAxis dataKey="fecha" tick={{ fill: g.eje, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fill: g.eje, fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={formatoEjeCompacto}
                          width={56}
                        />
                        <RechartsTooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const actual = Number(payload.find((x) => x.dataKey === 'Ventas')?.value ?? 0)
                            const ant = Number(payload.find((x) => x.dataKey === 'Anterior')?.value ?? 0)
                            const iso = (payload[0]?.payload as { fechaExacta?: string } | undefined)?.fechaExacta
                            return (
                              <div className="chart-tooltip">
                                <p>{iso ? fechaExactaLarga(iso) : String(label ?? '')}</p>
                                <p className="mt-1" style={{ color: '#6366F1' }}>
                                  Período actual: {formatoARS(actual)}
                                </p>
                                <p style={{ color: g.muted }}>Período anterior: {formatoARS(ant)}</p>
                              </div>
                            )
                          }}
                        />
                        <Legend wrapperStyle={{ color: g.eje, fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey="Ventas"
                          name="Período actual"
                          stroke="#6366F1"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="Anterior"
                          name="Período anterior"
                          stroke={g.muted}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className={`mt-8 ${cardClass}`} style={cardStyle}>
                  <Text className="!text-[#94A3B8]">¿Qué días vendés más?</Text>
                  <div className="mt-4" style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={diasSemana} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
                          formatter={(value) => formatoARS(Number(value ?? 0))}
                          contentStyle={{
                            background: g.tooltipBg,
                            border: `1px solid ${g.tooltipBorder}`,
                            borderRadius: 8,
                            color: g.tooltipFg,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={36}>
                          {diasSemana.map((d) => (
                            <Cell key={d.dia} fill={d.destacado ? '#4ADE80' : '#6366F1'} fillOpacity={d.destacado ? 1 : 0.45} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

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
