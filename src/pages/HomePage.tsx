import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { cargarDashboardInicio, type DashboardInicio } from '../lib/dashboard'
import { listarCumpleanosProximos, textoCumpleProximo, type CumpleProximo } from '../lib/clientes'
import { formatoARS } from '../lib/productos'
import { tienePermiso } from '../lib/permisos'
import { requireSupabase } from '../lib/supabase'
import {
  esAdminEmail,
  diasRestantes,
  iniciarPeriodoPrueba,
  leerSuscripcionActiva,
  type SuscripcionActiva,
} from '../lib/suscripcion'
import { theme } from '../theme'

const DASH_VACIO: DashboardInicio = {
  hoy: { cantidad: 0, total: 0 },
  semana: 0,
  mes: 0,
  comprasMes: 0,
  topHoy: null,
  ultimos7: [],
  top5: [],
  stock: [],
}

function IconoBolsa() {
  return (
    <svg className="h-8 w-8 text-[#A5B4FC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 10-8 0v4M5 9h14l-1 11H6L5 9z" />
    </svg>
  )
}

function IconoCalendario() {
  return (
    <svg className="h-8 w-8 text-[#A5B4FC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function IconoMes() {
  return (
    <svg className="h-8 w-8 text-[#A5B4FC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h6m-6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14" />
    </svg>
  )
}

function IconoCompras() {
  return (
    <svg className="h-8 w-8 text-[#A5B4FC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-2 9m12-9l2 9M9 22a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  )
}

function IconoProducto() {
  return (
    <svg className="h-8 w-8 text-[#A5B4FC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

function KpiCard({
  label,
  valor,
  detalle,
  icono,
  wrap,
}: {
  label: string
  valor: string
  detalle?: string
  icono: ReactNode
  wrap?: boolean
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(99,102,241,0.2)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#94A3B8]">{label}</p>
          <p
            className={`mt-2 font-bold leading-tight text-white ${
              wrap ? 'text-lg break-words' : 'whitespace-nowrap text-[24px]'
            }`}
          >
            {valor}
          </p>
          {detalle ? <p className="mt-1 text-xs text-[#A5B4FC]">{detalle}</p> : null}
        </div>
        <div className="shrink-0">{icono}</div>
      </div>
    </div>
  )
}

function truncarEtiqueta(nombre: string) {
  if (nombre.length <= 15) return nombre
  return `${nombre.slice(0, 15)}...`
}

function formatoKPI(valor: number) {
  const abs = Math.abs(valor)
  const signo = valor < 0 ? '-' : ''
  if (abs >= 10_000_000) {
    return `${signo}$${Math.round(abs / 1_000_000)}M`
  }
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    const s = m.toFixed(1).replace('.', ',').replace(/,0$/, '')
    return `${signo}$${s}M`
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor)
}

export function HomePage() {
  const { perfil, session, cerrarSesion, error } = useAuth()
  const [suscripcion, setSuscripcion] = useState<SuscripcionActiva | null>(null)
  const [dash, setDash] = useState<DashboardInicio>(DASH_VACIO)
  const [cumples, setCumples] = useState<CumpleProximo[]>([])

  useEffect(() => {
    if (!perfil) return
    const client = requireSupabase()
    void (async () => {
      let actual = await leerSuscripcionActiva(client, perfil.empresa.id)
      if (!actual) {
        await iniciarPeriodoPrueba(client, perfil.empresa.id, perfil.usuario.id)
        actual = await leerSuscripcionActiva(client, perfil.empresa.id)
      }
      setSuscripcion(actual)
      setDash(await cargarDashboardInicio(client))
      setCumples(await listarCumpleanosProximos(client))
    })()
  }, [perfil])

  if (!perfil) return null

  const rolLabel =
    perfil.usuario.rol === 'dueno'
      ? 'Dueño'
      : perfil.usuario.rol === 'operador'
        ? 'Operador'
        : 'Visor'

  const dias = diasRestantes(suscripcion?.fecha_vencimiento ?? null)
  const mostrarAdmin = esAdminEmail(session?.user.email ?? perfil.usuario.email)
  const verReportes = tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'ver_reportes')
  const gestionaStock = dash.stock.some((p) => p.stock !== 0)
  const alturaStock = Math.min(560, Math.max(220, dash.stock.length * 36))

  function colorStock(stock: number) {
    if (stock <= 0) return '#F87171'
    if (stock <= 5) return '#FCD34D'
    return '#4ADE80'
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
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <AppNav />
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#A5B4FC]">Analítica 360</p>
            <h1 className="text-xl font-bold text-white">{perfil.empresa.nombre}</h1>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Hola, {perfil.usuario.nombre} · {rolLabel} · Plan {perfil.empresa.plan_actual}
            </p>
          </div>
          <button
            className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white"
            type="button"
            onClick={() => void cerrarSesion()}
          >
            Cerrar sesión
          </button>
        </header>

        {suscripcion?.estado === 'periodo_prueba' ? (
          <p className="mb-4 rounded-lg bg-amber-100 px-3 py-3 text-sm text-amber-950">
            Estás en período de prueba gratuito — te quedan {dias} {dias === 1 ? 'día' : 'días'}
          </p>
        ) : null}

        {suscripcion?.estado === 'pendiente_pago' || suscripcion?.estado === 'vencida' ? (
          <p className="mb-4 rounded-lg bg-red-100 px-3 py-3 text-sm text-red-900">
            Tu período de prueba venció — escribinos para continuar
          </p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}

        {!verReportes && cumples.length > 0 ? (
          <p
            className="mb-4 rounded-lg px-3 py-3 text-sm"
            style={{
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid #FCD34D',
              color: '#FCD34D',
              borderRadius: 8,
            }}
          >
            🎂 Cumpleaños próximos: {cumples.map(textoCumpleProximo).join(', ')}
          </p>
        ) : null}

        {verReportes ? (
          <section className="mt-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="Ventas hoy"
                valor={formatoKPI(dash.hoy.total)}
                detalle={`${dash.hoy.cantidad} ${dash.hoy.cantidad === 1 ? 'transacción' : 'transacciones'}`}
                icono={<IconoBolsa />}
              />
              <KpiCard
                label="Ventas esta semana"
                valor={formatoKPI(dash.semana)}
                icono={<IconoCalendario />}
              />
              <KpiCard
                label="Ventas este mes"
                valor={formatoKPI(dash.mes)}
                icono={<IconoMes />}
              />
              <KpiCard
                label="Compras este mes"
                valor={formatoKPI(dash.comprasMes)}
                icono={<IconoCompras />}
              />
              <KpiCard
                label="Producto más vendido hoy"
                valor={dash.topHoy?.nombre ?? 'Sin ventas'}
                wrap
                detalle={
                  dash.topHoy
                    ? `${dash.topHoy.unidades} ${dash.topHoy.unidades === 1 ? 'unidad' : 'unidades'}`
                    : undefined
                }
                icono={<IconoProducto />}
              />
            </div>

            {cumples.length > 0 ? (
              <p
                className="mt-4 rounded-lg px-3 py-3 text-sm"
                style={{
                  background: 'rgba(251,191,36,0.1)',
                  border: '1px solid #FCD34D',
                  color: '#FCD34D',
                  borderRadius: 8,
                }}
              >
                🎂 Cumpleaños próximos: {cumples.map(textoCumpleProximo).join(', ')}
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}
              >
                <p className="text-xs font-medium text-[#94A3B8]">Ventas últimos 7 días</p>
                <div className="mt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dash.ultimos7} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="dia" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: '#94A3B8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={56}
                        tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(99,102,241,0.12)' }}
                        formatter={(value) => [formatoARS(Number(value ?? 0)), 'Total']}
                        contentStyle={{
                          background: '#1A2F4A',
                          border: '1px solid rgba(99,102,241,0.3)',
                          borderRadius: 8,
                          color: '#fff',
                        }}
                      />
                      <Bar dataKey="total" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div
                className="rounded-lg p-4"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}
              >
                <p className="text-xs font-medium text-[#94A3B8]">Top 5 productos más vendidos</p>
                <div className="mt-3" style={{ height: 320 }}>
                  {dash.top5.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-sm text-[#94A3B8]">
                      Todavía no hay ventas
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={dash.top5.map((p) => ({ ...p, etiqueta: truncarEtiqueta(p.nombre) }))}
                        margin={{ top: 8, right: 40, left: 120, bottom: 0 }}
                        barCategoryGap="30%"
                      >
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fill: '#94A3B8', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="etiqueta"
                          width={120}
                          tick={{ fill: '#E2E8F0', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(74,222,128,0.12)' }}
                          formatter={(value) => [`${Number(value ?? 0)} u.`, 'Unidades']}
                          contentStyle={{
                            background: '#1A2F4A',
                            border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: 8,
                            color: '#fff',
                          }}
                        />
                        <Bar dataKey="unidades" fill="#4ADE80" radius={[0, 4, 4, 0]} maxBarSize={18}>
                          <LabelList dataKey="unidades" position="right" fill="#4ADE80" fontSize={11} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            <div
              className="mt-3 rounded-lg p-4"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(99,102,241,0.2)',
              }}
            >
              <p className="text-xs font-medium text-[#94A3B8]">Estado de stock — productos activos</p>
              <div className="mt-3" style={{ height: gestionaStock ? alturaStock : 160 }}>
                {!gestionaStock ? (
                  <p className="flex h-full items-center justify-center text-sm text-[#94A3B8]">
                    Este negocio no gestiona stock por unidades
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={dash.stock}
                      margin={{ top: 8, right: 36, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: '#94A3B8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="nombre"
                        reversed
                        width={110}
                        tick={{ fill: '#E2E8F0', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(99,102,241,0.12)' }}
                        formatter={(value) => [`${Number(value ?? 0)} u.`, 'Stock']}
                        contentStyle={{
                          background: '#1A2F4A',
                          border: '1px solid rgba(99,102,241,0.3)',
                          borderRadius: 8,
                          color: '#fff',
                        }}
                      />
                      <Bar dataKey="stock" radius={[0, 4, 4, 0]} maxBarSize={18}>
                        {dash.stock.map((fila, i) => (
                          <Cell key={`${fila.nombre}-${i}`} fill={colorStock(fila.stock)} />
                        ))}
                        <LabelList
                          dataKey="stock"
                          position="right"
                          fill="#E2E8F0"
                          fontSize={11}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {mostrarAdmin ? (
          <p className="mt-4 text-sm">
            <Link className="font-medium text-[#A5B4FC]" to="/admin">
              Panel admin
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  )
}
