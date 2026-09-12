import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { GraficoExpandible, SelectorChips } from '../components/GraficoExpandible'
import { InflacionVsPreciosPanel } from '../components/InflacionVsPreciosPanel'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { PlanesModal } from '../components/PlanesModal'
import { ChartTooltipBox } from '../components/CustomTooltip'
import { formatoEjeCompacto, fechaHoyAR, guardarPeriodoAnalytics, limpiarPeriodoAnalytics, rangoPreset, type PresetPeriodo } from '../lib/analytics'
import { obtenerConfiguracion } from '../lib/configuracion'
import {
  armarForecast,
  cargarInsights,
  cargarInsightsCombos,
  cargarInsightsCombos3,
  contarProductosCatalogo,
  type FilaElasticidad,
  type GranularidadForecast,
  type InsightCombo,
  type InsightForecast,
  type InsightsPayload,
} from '../lib/insights'
import { planTieneInsights } from '../lib/planes'
import { formatoARS } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import {
  cargarInflacionVsPrecios,
  rangoDatosIndec,
  resolverPeriodoInflacion,
  SERIE_INFLACION_VACIA,
  type SerieInflacionPrecios,
} from '../lib/inflacion'
import { theme } from '../theme'

const CARD = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(99,102,241,0.2)',
} as const

function TituloSeccion({ children }: { children: ReactNode }) {
  return (
    <h2
      className="mb-1"
      style={{ fontFamily: theme.fontDisplay, fontSize: 22, color: '#F1F5F9', fontWeight: 600 }}
    >
      {children}
    </h2>
  )
}

function Sub({ children }: { children: ReactNode }) {
  return <p style={{ color: '#94A3B8', fontSize: 13 }}>{children}</p>
}

function Divider() {
  return <div className="my-8" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
}

function ErrorSeccion({ mensaje }: { mensaje: string }) {
  return (
    <p className="rounded-lg bg-red-500/10 px-3 py-3 text-sm text-red-200">
      No se pudo cargar esta sección. {mensaje}
    </p>
  )
}

function SkeletonInsights() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando insights">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((k) => (
          <div key={k} className="rounded-lg p-4" style={CARD}>
            <div className="kpi-skeleton-bar" style={{ width: '50%', height: 14 }} />
            <div className="kpi-skeleton-bar mt-3" style={{ width: '70%', height: 28 }} />
          </div>
        ))}
      </div>
      {[1, 2, 3].map((k) => (
        <div key={k} className="rounded-lg p-5" style={CARD}>
          <div className="kpi-skeleton-bar" style={{ width: '40%', height: 22 }} />
          <div className="kpi-skeleton-bar mt-2" style={{ width: '70%', height: 14 }} />
          <div className="kpi-skeleton-bar mt-4" style={{ height: 180, borderRadius: 8 }} />
        </div>
      ))}
    </div>
  )
}

function badgeLift(lift: number) {
  if (lift > 2) return { bg: 'rgba(74,222,128,0.15)', fg: '#4ADE80', label: '🔥 Muy fuerte' }
  if (lift >= 1.5) return { bg: 'rgba(99,102,241,0.2)', fg: '#A5B4FC', label: '💪 Fuerte' }
  if (lift >= 1) return { bg: 'rgba(252,211,77,0.15)', fg: '#FCD34D', label: '👍 Moderado' }
  return { bg: 'rgba(148,163,184,0.15)', fg: '#94A3B8', label: 'Bajo' }
}

function ComboCard({
  combo,
  destacado,
  onCrear,
}: {
  combo: InsightCombo
  destacado: boolean
  onCrear: () => void
}) {
  const badge = badgeLift(combo.lift)
  const soportePct = Math.min(100, Math.max(0, combo.soporte))
  const titulo = [combo.nombreA, combo.nombreB, combo.nombreC].filter(Boolean).join(' + ')
  return (
    <article
      className="flex flex-col rounded-xl p-4"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(99,102,241,0.2)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-semibold text-[#F1F5F9]">
          {destacado ? '🏆 ' : ''}
          {titulo}
        </h3>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: badge.bg, color: badge.fg }}
        >
          {badge.label}
        </span>
      </div>
      <p className="mt-2 text-sm text-[#94A3B8]">
        Se vendieron juntos {combo.vecesJuntos.toLocaleString('es-AR')} veces
      </p>
      <p className="mt-3 text-sm text-[#F1F5F9]">
        {combo.confianzaA != null
          ? `Confianza: ${combo.confianzaA.toLocaleString('es-AR')}% · Lift: ${combo.lift.toLocaleString('es-AR')}`
          : `Lift: ${combo.lift.toLocaleString('es-AR')}`}
      </p>
      <div className="mt-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#6366F1]" style={{ width: `${soportePct}%` }} />
        </div>
        <p className="mt-1 text-xs text-[#94A3B8]">Soporte: {combo.soporte.toLocaleString('es-AR')}%</p>
      </div>
      {combo.confianzaA != null && combo.nombreC == null ? (
        <p className="mt-3 text-sm leading-relaxed text-[#F1F5F9]">
          💡 Cuando alguien compra {combo.nombreA}, {combo.confianzaA.toLocaleString('es-AR')}% de las veces también
          lleva {combo.nombreB}
        </p>
      ) : null}
      <button
        className="mt-4 h-10 rounded-lg bg-[#6366F1] px-3 text-sm font-semibold text-white hover:bg-[#4F46E5]"
        type="button"
        onClick={onCrear}
      >
        🎁 Crear combo con descuento
      </button>
    </article>
  )
}

function badgeElasticidad(fila: FilaElasticidad) {
  if (fila.badge === 'inelastica') return { bg: 'rgba(74,222,128,0.15)', fg: '#4ADE80', label: 'Inelástica' }
  if (fila.badge === 'moderada') return { bg: 'rgba(252,211,77,0.15)', fg: '#FCD34D', label: 'Moderada' }
  if (fila.badge === 'elastica') return { bg: 'rgba(248,113,113,0.15)', fg: '#F87171', label: 'Elástica' }
  return { bg: 'rgba(99,102,241,0.2)', fg: '#A5B4FC', label: 'Giffen' }
}

function tickRadar(props: {
  x?: number
  y?: number
  textAnchor?: 'start' | 'middle' | 'end' | 'inherit'
  payload?: { value?: string }
  ejes?: { eje: string; valor: number }[]
}) {
  const label = String(props.payload?.value ?? '')
  const valor = props.ejes?.find((e) => e.eje === label)?.valor ?? 0
  const anchor = props.textAnchor ?? 'middle'
  return (
    <text
      x={props.x}
      y={props.y}
      textAnchor={anchor}
      fill={valor < 40 ? '#F87171' : '#F1F5F9'}
      fontSize={12}
    >
      {label}
    </text>
  )
}

function GraficoForecast({ data }: { data: InsightForecast }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data.puntos} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: '#94A3B8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={formatoEjeCompacto}
        />
        <RechartsTooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <ChartTooltipBox>
                <p className="text-sm font-semibold text-[#F1F5F9]">{String(label)}</p>
                {payload.map((p) =>
                  p.value == null ? null : (
                    <p key={String(p.dataKey)} className="mt-1 text-xs text-[#94A3B8]">
                      {p.dataKey === 'historico' ? 'Histórico' : 'Proyección'}: {formatoARS(Number(p.value))}
                    </p>
                  ),
                )}
              </ChartTooltipBox>
            )
          }}
        />
        <Area
          type="monotone"
          dataKey="proyeccion"
          stroke="none"
          fill="rgba(74,222,128,0.1)"
          connectNulls
          isAnimationActive
          animationDuration={450}
        />
        <Line
          type="monotone"
          dataKey="historico"
          stroke="#6366F1"
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive
          animationDuration={450}
        />
        <Line
          type="monotone"
          dataKey="proyeccion"
          stroke="#4ADE80"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          connectNulls
          isAnimationActive
          animationDuration={450}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function GraficoRadar({ ejes }: { ejes: { eje: string; valor: number; fullMark: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={ejes} cx="50%" cy="50%" outerRadius="72%">
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis
          dataKey="eje"
          tick={(props) =>
            tickRadar({
              x: Number(props.x),
              y: Number(props.y),
              textAnchor:
                props.textAnchor === 'start' || props.textAnchor === 'end' || props.textAnchor === 'inherit'
                  ? props.textAnchor
                  : 'middle',
              payload: { value: String(props.payload?.value ?? '') },
              ejes,
            })
          }
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          dataKey="valor"
          stroke="#6366F1"
          fill="rgba(99,102,241,0.25)"
          fillOpacity={1}
          dot={{ r: 4, fill: '#6366F1', stroke: '#6366F1' }}
          isAnimationActive
          animationDuration={450}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function GraficoBarrasAtributo({
  valores,
}: {
  valores: { name: string; pct: number; unidades: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={valores} margin={{ top: 4, right: 36, left: 8, bottom: 0 }}>
        <XAxis type="number" hide domain={[0, 100]} />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          tick={{ fill: '#F1F5F9', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <RechartsTooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as { name: string; pct: number; unidades: number }
            return (
              <ChartTooltipBox>
                <p className="text-sm font-semibold text-[#F1F5F9]">{p.name}</p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  {p.pct.toFixed(1)}% · {p.unidades} u
                </p>
              </ChartTooltipBox>
            )
          }}
        />
        <Bar dataKey="pct" fill="#6366F1" radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive animationDuration={450} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const COMBOS_TAMANO: { id: '2' | '3'; label: string }[] = [
  { id: '2', label: '2 productos' },
  { id: '3', label: '3 productos' },
]

const GRANULARIDADES: { id: GranularidadForecast; label: string }[] = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'anio', label: 'Año' },
]

const PRESETS_INFLACION: { id: PresetPeriodo | 'todo'; label: string }[] = [
  { id: 'todo', label: 'Todos los datos' },
  { id: 'semana', label: 'Última semana' },
  { id: 'mes', label: 'Último mes' },
  { id: 'tres_meses', label: 'Últimos 3 meses' },
  { id: 'anio', label: 'Último año' },
  { id: 'personalizado', label: 'Rango personalizado' },
]

export function InsightsPage() {
  const { perfil } = useAuth()
  const [searchParams] = useSearchParams()
  const [modalPlanes, setModalPlanes] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [data, setData] = useState<InsightsPayload | null>(null)
  const [granularidad, setGranularidad] = useState<GranularidadForecast>('semana')
  const [forecast, setForecast] = useState<InsightForecast | null>(null)
  const [cargandoForecast, setCargandoForecast] = useState(false)
  const [inflacion, setInflacion] = useState<SerieInflacionPrecios>(SERIE_INFLACION_VACIA)
  const [inflacionPeriodo, setInflacionPeriodo] = useState(() => resolverPeriodoInflacion())
  const [presetInfla, setPresetInfla] = useState<PresetPeriodo | 'todo'>('todo')
  const [desdeDraft, setDesdeDraft] = useState(() => resolverPeriodoInflacion().desde)
  const [hastaDraft, setHastaDraft] = useState(() => resolverPeriodoInflacion().hasta)
  const [combos, setCombos] = useState<InsightCombo[]>([])
  const [combos3, setCombos3] = useState<InsightCombo[]>([])
  const [errorCombos, setErrorCombos] = useState<string | null>(null)
  const [errorCombos3, setErrorCombos3] = useState<string | null>(null)
  const [combos3Listo, setCombos3Listo] = useState(false)
  const [cargandoCombos3, setCargandoCombos3] = useState(false)
  const [tamanoCombo, setTamanoCombo] = useState<'2' | '3'>('2')
  const [nProductos, setNProductos] = useState(0)
  const [modalCombo, setModalCombo] = useState(false)

  const premium = Boolean(perfil && planTieneInsights(perfil.empresa.plan_actual))

  useEffect(() => {
    const q = searchParams.toString()
    const r = resolverPeriodoInflacion(q ? `?${q}` : '')
    setInflacionPeriodo(r)
    setDesdeDraft(r.desde)
    setHastaDraft(r.hasta)
    const indec = rangoDatosIndec()
    setPresetInfla(r.desde === indec.desde && r.hasta === indec.hasta ? 'todo' : 'personalizado')
  }, [searchParams])

  useEffect(() => {
    if (!perfil || !planTieneInsights(perfil.empresa.plan_actual)) {
      setCargando(false)
      return
    }
    setCargando(true)
    void (async () => {
      try {
        const cfg = await obtenerConfiguracion(requireSupabase(), perfil.empresa.id)
        const client = requireSupabase()
        const [payload, combosRes, nProds] = await Promise.all([
          cargarInsights(client, Boolean(cfg.config.usaVariantes)),
          cargarInsightsCombos(client, perfil.empresa.id),
          contarProductosCatalogo(client),
        ])
        setData(payload)
        setCombos(combosRes.filas)
        setErrorCombos(combosRes.error)
        setNProductos(nProds)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error inesperado'
        setData({
          salud: null,
          elasticidades: [],
          forecast: null,
          serieDiaria: [],
          diasHistorial: 0,
          variantes: null,
          precios: [],
          errores: {
            radar: msg,
            elasticidad: msg,
            forecast: msg,
            variantes: msg,
            precio: msg,
          },
        })
      } finally {
        setCargando(false)
      }
    })()
  }, [perfil])

  useEffect(() => {
    if (!perfil || !planTieneInsights(perfil.empresa.plan_actual)) return
    if (tamanoCombo !== '3' || combos3Listo) return
    let cancel = false
    setCargandoCombos3(true)
    void (async () => {
      const res = await cargarInsightsCombos3(requireSupabase(), perfil.empresa.id)
      if (cancel) return
      setCombos3(res.filas)
      setErrorCombos3(res.error)
      setCombos3Listo(true)
      setCargandoCombos3(false)
    })()
    return () => {
      cancel = true
      setCargandoCombos3(false)
    }
  }, [perfil, tamanoCombo, combos3Listo])

  useEffect(() => {
    if (!perfil || !planTieneInsights(perfil.empresa.plan_actual)) return
    let cancel = false
    void (async () => {
      try {
        const infla = await cargarInflacionVsPrecios(
          requireSupabase(),
          inflacionPeriodo.desde,
          inflacionPeriodo.hasta,
          perfil.empresa.id,
        )
        if (!cancel) setInflacion(infla)
      } catch {
        if (!cancel) {
          setInflacion({
            ...SERIE_INFLACION_VACIA,
            errorInflacion: 'Datos de inflación no disponibles para este período',
            desde: inflacionPeriodo.desde,
            hasta: inflacionPeriodo.hasta,
          })
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [perfil, inflacionPeriodo.desde, inflacionPeriodo.hasta])

  useEffect(() => {
    if (!data || data.diasHistorial < 30 || data.serieDiaria.length < 2) {
      setForecast(data?.forecast ?? null)
      return
    }
    let cancel = false
    setCargandoForecast(true)
    void armarForecast(data.serieDiaria, granularidad, fechaHoyAR(), data.diasHistorial)
      .then((fila) => {
        if (!cancel) setForecast(fila)
      })
      .catch(() => {
        if (!cancel) setForecast(null)
      })
      .finally(() => {
        if (!cancel) setCargandoForecast(false)
      })
    return () => {
      cancel = true
    }
  }, [data, granularidad])

  function aplicarPeriodoInflacion(r: { desde: string; hasta: string }, preset: PresetPeriodo | 'todo') {
    setPresetInfla(preset)
    setInflacionPeriodo(r)
    setDesdeDraft(r.desde)
    setHastaDraft(r.hasta)
    if (preset === 'todo') limpiarPeriodoAnalytics()
    else guardarPeriodoAnalytics(r.desde, r.hasta)
  }

  if (!perfil) return null

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
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wide text-[#A5B4FC]">Analítica 360</p>
          <h1 className="mt-1 text-xl font-bold">Insights</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">Inteligencia de datos para decidir precios, stock y mix.</p>
        </div>

        {!premium ? (
          <div className="mx-auto max-w-lg rounded-lg px-6 py-10 text-center" style={CARD}>
            <svg className="mx-auto h-10 w-10 text-[#A5B4FC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <p className="mt-4 text-lg font-semibold">
              Disponible en Plan Premium — Analizá tu negocio con inteligencia de datos
            </p>
            <button
              className="mt-6 h-11 rounded-md bg-[#6366F1] px-5 text-sm font-semibold text-white hover:bg-[#4F46E5]"
              type="button"
              onClick={() => setModalPlanes(true)}
            >
              Ver planes
            </button>
          </div>
        ) : cargando ? (
          <SkeletonInsights />
        ) : data ? (
          <>
            <section className="rounded-lg p-5" style={CARD}>
              <TituloSeccion>🎯 Radar de salud del negocio</TituloSeccion>
              <Sub>Cinco ejes de 0 a 100. El score es el promedio ponderado.</Sub>
              {data.errores.radar ? (
                <div className="mt-4">
                  <ErrorSeccion mensaje={data.errores.radar} />
                </div>
              ) : data.salud ? (
                <>
                  <GraficoExpandible
                    titulo="🎯 Radar de salud del negocio"
                    compactoClass="mx-auto h-[320px] max-w-lg"
                    ocultarTitulo
                  >
                    <GraficoRadar ejes={data.salud.ejes} />
                  </GraficoExpandible>
                  <p className="mt-2 text-center text-xs leading-relaxed text-[#94A3B8]">
                    Cinco dimensiones de tu negocio de 0 a 100. Un polígono grande y simétrico indica un negocio
                    equilibrado.
                  </p>
                  <p className="mt-2 text-center text-5xl font-bold" style={{ color: data.salud.color }}>
                    {data.salud.score}
                  </p>
                  <p className="mt-1 text-center text-sm font-semibold" style={{ color: data.salud.color }}>
                    {data.salud.etiqueta}
                  </p>
                  {data.salud.bullets.length > 0 ? (
                    <ul className="mt-5 space-y-2 text-sm text-[#F1F5F9]">
                      {data.salud.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
            </section>

            <Divider />

            <section className="rounded-lg p-5" style={CARD}>
              <TituloSeccion>📊 Elasticidad de demanda</TituloSeccion>
              <Sub>Cómo reaccionan las unidades vendidas cuando cambia el precio.</Sub>
              {data.errores.elasticidad ? (
                <div className="mt-4">
                  <ErrorSeccion mensaje={data.errores.elasticidad} />
                </div>
              ) : data.elasticidades.length === 0 ? (
                <p className="mt-4 text-sm leading-relaxed text-[#F1F5F9]">
                  Todavía no hay cambios de precio con historial suficiente. La elasticidad mide cuánto
                  se mueven las ventas cuando subís o bajás el precio (ΔQ% / ΔP%). Cuando un producto
                  tenga al menos dos precios distintos en el historial y ventas a ambos lados del
                  cambio, acá vas a ver si la demanda es inelástica, moderada o elástica.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-[#94A3B8]">
                      <tr>
                        <th className="py-2 pr-3">Producto</th>
                        <th className="py-2 pr-3">P. anterior</th>
                        <th className="py-2 pr-3">P. actual</th>
                        <th className="py-2 pr-3">Δ Precio</th>
                        <th className="py-2 pr-3">Δ Ventas</th>
                        <th className="py-2 pr-3">Elasticidad</th>
                        <th className="py-2">Recomendación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.elasticidades.map((fila) => {
                        const b = badgeElasticidad(fila)
                        return (
                          <tr key={fila.productoId} className="border-t border-white/10">
                            <td className="py-3 pr-3 font-medium">{fila.producto}</td>
                            <td className="py-3 pr-3">{formatoARS(fila.precioAnterior)}</td>
                            <td className="py-3 pr-3">{formatoARS(fila.precioActual)}</td>
                            <td className="py-3 pr-3">{fila.deltaPrecioPct.toFixed(1)}%</td>
                            <td className="py-3 pr-3">{fila.deltaVentasPct.toFixed(1)}%</td>
                            <td className="py-3 pr-3">{fila.elasticidad.toFixed(2)}</td>
                            <td className="py-3">
                              <span
                                className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                                style={{ background: b.bg, color: b.fg }}
                              >
                                {b.label}
                              </span>
                              <span className="mt-1 block text-xs text-[#94A3B8]">{fila.recomendacion}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <Divider />

            <section className="rounded-lg p-5" style={CARD}>
              <TituloSeccion>📉 Inflación vs evolución de tus precios</TituloSeccion>
              <Sub>
                {inflacionPeriodo.desde} → {inflacionPeriodo.hasta}
              </Sub>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS_INFLACION.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`rounded-md px-3 py-2 text-xs font-semibold ${
                      presetInfla === p.id ? 'bg-[#6366F1] text-white' : 'bg-white/10 text-[#A5B4FC]'
                    }`}
                    onClick={() => {
                      if (p.id === 'todo') {
                        aplicarPeriodoInflacion(rangoDatosIndec(), 'todo')
                        return
                      }
                      setPresetInfla(p.id)
                      if (p.id !== 'personalizado') {
                        aplicarPeriodoInflacion(rangoPreset(p.id), p.id)
                      }
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {presetInfla === 'personalizado' ? (
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
                  <button
                    className="h-10 self-end rounded-md bg-[#6366F1] px-4 text-sm font-semibold text-white hover:bg-[#4F46E5] sm:col-span-2"
                    type="button"
                    onClick={() => aplicarPeriodoInflacion(rangoPreset('personalizado', desdeDraft, hastaDraft), 'personalizado')}
                  >
                    Aplicar período
                  </button>
                </div>
              ) : null}
              <div className="mt-4">
                <InflacionVsPreciosPanel serie={inflacion} />
              </div>
            </section>

            <Divider />

            <section className="rounded-lg p-5" style={CARD}>
              <TituloSeccion>🔮 Proyección de ventas</TituloSeccion>
              <Sub>
                Día: 30 días + 14 de proyección. Semana: 90 días (todas las semanas del rango) + 4 adelante. Mes:
                6 meses + 3 adelante. Año: años con ventas + 2 adelante. Siempre se usa ventas.fecha, ordenado ASC.
              </Sub>
              {data.errores.forecast ? (
                <div className="mt-4">
                  <ErrorSeccion mensaje={data.errores.forecast} />
                </div>
              ) : data.diasHistorial < 30 ? (
                <p className="mt-4 text-sm text-[#F1F5F9]">
                  Necesitás al menos 30 días de historial. Tenés {data.diasHistorial}{' '}
                  {data.diasHistorial === 1 ? 'día' : 'días'}.
                </p>
              ) : forecast ? (
                <>
                  <GraficoExpandible
                    titulo="🔮 Proyección de ventas"
                    compactoClass="h-64"
                    ocultarTitulo
                    toolbar={
                      <SelectorChips
                        valor={granularidad}
                        opciones={GRANULARIDADES}
                        onChange={setGranularidad}
                      />
                    }
                  >
                    <GraficoForecast data={forecast} />
                  </GraficoExpandible>
                  <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
                    Estimación basada en tu tendencia histórica. La línea punteada es proyección — usala como
                    orientación.
                  </p>
                  {cargandoForecast ? (
                    <p className="mt-2 text-xs text-[#94A3B8]">Actualizando proyección…</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-[#F1F5F9]">
                      {forecast.etiquetaProyeccion}: {formatoARS(forecast.totalProyeccion)}
                    </p>
                    {forecast.tendencia === 'positiva' ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-[#4ADE80]">
                        ↑ Positiva
                      </span>
                    ) : forecast.tendencia === 'negativa' ? (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-[#F87171]">
                        ↓ Negativa
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-[#94A3B8]">
                        → Estable
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-4 rounded-lg px-3 py-3"
                    style={{
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.35)',
                      color: '#94A3B8',
                      fontSize: 12,
                    }}
                  >
                    ℹ️ Esta proyección usa regresión lineal sobre {forecast.periodosHistorial}{' '}
                    {forecast.granularidad === 'dia'
                      ? forecast.periodosHistorial === 1
                        ? 'día'
                        : 'días'
                      : forecast.granularidad === 'semana'
                        ? forecast.periodosHistorial === 1
                          ? 'semana'
                          : 'semanas'
                        : forecast.granularidad === 'mes'
                          ? forecast.periodosHistorial === 1
                            ? 'mes'
                            : 'meses'
                          : forecast.periodosHistorial === 1
                            ? 'año'
                            : 'años'}{' '}
                    de historial real. Los picos estacionales (ferias, fechas especiales) pueden afectar la
                    precisión. Usala como orientación, no como certeza.
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm text-[#94A3B8]">Hace falta al menos dos períodos con ventas para proyectar.</p>
              )}
            </section>

            {data.variantes?.hayVentas ? (
              <>
                <Divider />
                <section className="rounded-lg p-5" style={CARD}>
                  <TituloSeccion>🎨 Distribución de variantes</TituloSeccion>
                  <Sub>Participación de cada atributo y combinaciones más vendidas.</Sub>
                  {data.errores.variantes ? (
                    <div className="mt-4">
                      <ErrorSeccion mensaje={data.errores.variantes} />
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {data.variantes.porAtributo.map((grupo) => (
                          <div key={grupo.atributo}>
                            <p className="mb-2 text-sm font-semibold text-[#F1F5F9]">{grupo.atributo}</p>
                            <GraficoExpandible
                              titulo={`🎨 ${grupo.atributo}`}
                              compactoClass="h-48"
                              ocultarTitulo
                            >
                              <GraficoBarrasAtributo valores={grupo.valores} />
                            </GraficoExpandible>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[480px] text-left text-sm">
                          <thead className="text-xs uppercase tracking-wide text-[#94A3B8]">
                            <tr>
                              <th className="py-2 pr-3">Variante</th>
                              <th className="py-2 pr-3">Unidades</th>
                              <th className="py-2 pr-3">% total</th>
                              <th className="py-2">Tendencia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.variantes.combinaciones.map((c) => (
                              <tr key={c.id} className="border-t border-white/10">
                                <td className="py-2 pr-3">{c.etiqueta}</td>
                                <td className="py-2 pr-3">{c.unidades}</td>
                                <td className="py-2 pr-3">{c.pct.toFixed(1)}%</td>
                                <td className="py-2">
                                  {c.tendencia === 'up' ? '↑' : c.tendencia === 'down' ? '↓' : '→'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <ul className="mt-4 space-y-2 text-sm text-[#F1F5F9]">
                        {data.variantes.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>
              </>
            ) : data.errores.variantes ? (
              <>
                <Divider />
                <ErrorSeccion mensaje={data.errores.variantes} />
              </>
            ) : null}

            {data.precios.length > 0 || data.errores.precio ? (
              <>
                <Divider />
                <section className="rounded-lg p-5" style={CARD}>
                  <TituloSeccion>💰 Precio óptimo sugerido</TituloSeccion>
                  <Sub>Solo productos con elasticidad negativa y precio sugerido por encima del actual.</Sub>
                  {data.errores.precio ? (
                    <div className="mt-4">
                      <ErrorSeccion mensaje={data.errores.precio} />
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[560px] text-left text-sm">
                          <thead className="text-xs uppercase tracking-wide text-[#94A3B8]">
                            <tr>
                              <th className="py-2 pr-3">Producto</th>
                              <th className="py-2 pr-3">Precio actual</th>
                              <th className="py-2 pr-3">Precio sugerido</th>
                              <th className="py-2">Ganancia adicional estimada/mes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.precios.map((p) => (
                              <tr key={p.producto} className="border-t border-white/10">
                                <td className="py-2 pr-3">{p.producto}</td>
                                <td className="py-2 pr-3">{formatoARS(p.precioActual)}</td>
                                <td className="py-2 pr-3">{formatoARS(p.precioSugerido)}</td>
                                <td className="py-2">{formatoARS(p.extraMes)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-4 space-y-3">
                        {data.precios.map((p) => (
                          <p key={`card-${p.producto}`} className="rounded-lg bg-white/5 px-3 py-3 text-sm text-[#F1F5F9]">
                            💰 Si subís {p.producto} de {formatoARS(p.precioActual)} a {formatoARS(p.precioSugerido)},
                            estimamos {formatoARS(p.extraMes)} más por mes
                          </p>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              </>
            ) : null}

            <Divider />
            <section className="rounded-lg p-5" style={CARD}>
              <TituloSeccion>🎁 Oportunidades de combos</TituloSeccion>
              <Sub>Productos que tus clientes compran juntos</Sub>
              <p className="mt-1 text-xs leading-relaxed text-[#94A3B8]">
                Basado en el análisis de todas tus ventas con múltiples productos.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-sm text-[#94A3B8]">Mostrar combos de:</p>
                <SelectorChips valor={tamanoCombo} opciones={COMBOS_TAMANO} onChange={setTamanoCombo} />
              </div>
              {tamanoCombo === '3' && nProductos > 50 ? (
                <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  ⚠️ Con muchos productos este análisis puede tardar unos segundos
                </p>
              ) : null}
              {tamanoCombo === '2' && errorCombos ? (
                <div className="mt-4">
                  <ErrorSeccion mensaje={errorCombos} />
                </div>
              ) : tamanoCombo === '3' && errorCombos3 ? (
                <div className="mt-4">
                  <ErrorSeccion mensaje={errorCombos3} />
                </div>
              ) : (
                <div className="mt-4">
                  <GraficoExpandible
                    titulo="🎁 Oportunidades de combos"
                    ocultarTitulo
                    compactoClass="overflow-auto"
                  >
                    {tamanoCombo === '3' && cargandoCombos3 ? (
                      <p className="px-3 py-8 text-center text-sm text-[#94A3B8]">Calculando combos de 3 productos…</p>
                    ) : (tamanoCombo === '2' ? combos : combos3).length === 0 ? (
                      <div className="px-3 py-10 text-center">
                        <p className="text-4xl">🎁</p>
                        <p className="mt-3 text-base font-semibold text-[#F1F5F9]">Aún no hay datos de combos</p>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#94A3B8]">
                          {tamanoCombo === '3'
                            ? 'Cuando tengas ventas con 3 o más productos, acá vas a ver qué tríos se compran juntos.'
                            : 'Cuando tengas ventas con 2 o más productos, acá vas a ver qué combinaciones son más populares para crear ofertas y combos.'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {(tamanoCombo === '2' ? combos : combos3).map((combo, i) => (
                          <ComboCard
                            key={`${combo.nombreA}|${combo.nombreB}|${combo.nombreC ?? ''}`}
                            combo={combo}
                            destacado={i === 0}
                            onCrear={() => setModalCombo(true)}
                          />
                        ))}
                      </div>
                    )}
                  </GraficoExpandible>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
      <PlanesModal abierto={modalPlanes} onCerrar={() => setModalPlanes(false)} />
      {modalCombo ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModalCombo(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-xl p-6"
            style={{
              background: 'rgba(15,23,41,0.96)',
              border: '1px solid rgba(99,102,241,0.3)',
            }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <p className="text-lg font-semibold text-[#F1F5F9]">🎁 Crear combo</p>
            <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
              Próximamente: creá combos con descuento directamente desde acá
            </p>
            <button
              className="mt-5 h-10 w-full rounded-lg bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5]"
              type="button"
              onClick={() => setModalCombo(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
