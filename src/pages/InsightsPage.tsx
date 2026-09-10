import { useEffect, useState, type ReactNode } from 'react'
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
import { ParticleNetwork } from '../components/ParticleNetwork'
import { PlanesModal } from '../components/PlanesModal'
import { ChartTooltipBox } from '../components/CustomTooltip'
import { formatoEjeCompacto } from '../lib/analytics'
import { obtenerConfiguracion } from '../lib/configuracion'
import {
  cargarInsights,
  type FilaElasticidad,
  type InsightsPayload,
} from '../lib/insights'
import { planTieneInsights } from '../lib/planes'
import { formatoARS } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
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

export function InsightsPage() {
  const { perfil } = useAuth()
  const [modalPlanes, setModalPlanes] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [data, setData] = useState<InsightsPayload | null>(null)

  const premium = Boolean(perfil && planTieneInsights(perfil.empresa.plan_actual))

  useEffect(() => {
    if (!perfil || !planTieneInsights(perfil.empresa.plan_actual)) {
      setCargando(false)
      return
    }
    setCargando(true)
    void (async () => {
      try {
        const cfg = await obtenerConfiguracion(requireSupabase(), perfil.empresa.id)
        const payload = await cargarInsights(requireSupabase(), Boolean(cfg.config.usaVariantes))
        setData(payload)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error inesperado'
        setData({
          salud: null,
          elasticidades: [],
          forecast: null,
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
                  <div className="mx-auto mt-4 h-[320px] max-w-lg">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={data.salud.ejes} cx="50%" cy="50%" outerRadius="72%">
                        <PolarGrid stroke="rgba(255,255,255,0.1)" />
                        <PolarAngleAxis
                          dataKey="eje"
                          tick={(props) =>
                            tickRadar({
                              x: Number(props.x),
                              y: Number(props.y),
                              textAnchor:
                                props.textAnchor === 'start' ||
                                props.textAnchor === 'end' ||
                                props.textAnchor === 'inherit'
                                  ? props.textAnchor
                                  : 'middle',
                              payload: { value: String(props.payload?.value ?? '') },
                              ejes: data.salud?.ejes,
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
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
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
              <TituloSeccion>🔮 Proyección de ventas</TituloSeccion>
              <Sub>Regresión lineal sobre semanas de los últimos 90 días, 4 semanas hacia adelante.</Sub>
              {data.errores.forecast ? (
                <div className="mt-4">
                  <ErrorSeccion mensaje={data.errores.forecast} />
                </div>
              ) : data.diasHistorial < 30 ? (
                <p className="mt-4 text-sm text-[#F1F5F9]">
                  Necesitás al menos 30 días de historial. Tenés {data.diasHistorial}{' '}
                  {data.diasHistorial === 1 ? 'día' : 'días'}.
                </p>
              ) : data.forecast ? (
                <>
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.forecast.puntos} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="semana" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
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
                                      {p.dataKey === 'historico' ? 'Histórico' : 'Proyección'}:{' '}
                                      {formatoARS(Number(p.value))}
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
                        />
                        <Line
                          type="monotone"
                          dataKey="historico"
                          stroke="#6366F1"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="proyeccion"
                          stroke="#4ADE80"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-[#F1F5F9]">
                      Proyección próximas 4 semanas: {formatoARS(data.forecast.totalProyeccion)}
                    </p>
                    {data.forecast.tendencia === 'positiva' ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-[#4ADE80]">
                        ↑ Positiva
                      </span>
                    ) : data.forecast.tendencia === 'negativa' ? (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-[#F87171]">
                        ↓ Negativa
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-[#94A3B8]">
                        → Estable
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-[#94A3B8]">Hace falta al menos dos semanas con ventas para proyectar.</p>
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
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={grupo.valores} margin={{ top: 4, right: 36, left: 8, bottom: 0 }}>
                                  <XAxis type="number" hide domain={[0, 100]} />
                                  <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={90}
                                    tick={{ fill: '#F1F5F9', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <Bar dataKey="pct" fill="#6366F1" radius={[0, 4, 4, 0]} maxBarSize={16} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
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
          </>
        ) : null}
      </div>
      <PlanesModal abierto={modalPlanes} onCerrar={() => setModalPlanes(false)} />
    </div>
  )
}
