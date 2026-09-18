import { memo, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Rectangle,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { ChartResponsive, propsEjeX, propsEjeY, useEsMobile } from '../components/ChartResponsive'
import { GraficoExpandible, SelectorChips } from '../components/GraficoExpandible'
import {
  cargarDashboardInicio,
  cargarSerieVentasHome,
  procesarDatosGrafico,
  procesarTopProductos,
  recortarSerieHome,
  type DashboardInicio,
  type RangoHome,
} from '../lib/dashboard'
import { textoCumpleProximo } from '../lib/clientes'
import { tienePermiso } from '../lib/permisos'
import { requireSupabase } from '../lib/supabase'
import { bannerTicketsHome, type BannerTicketHome } from '../lib/tickets'
import { contarAlertasLotes } from '../lib/lotes'
import { obtenerConfiguracion } from '../lib/configuracion'
import {
  esAdminEmail,
  diasRestantes,
  estaEnTrial,
  trialVencido,
} from '../lib/suscripcion'
import { etiquetaPlan, formatoPrecioPlan, MESES_DESCUENTO_LANZAMIENTO, planEsIlimitado, precioLanzamiento } from '../lib/planes'
import { LimitePlanModal } from '../components/LimitePlanModal'
import { theme } from '../theme'
import { coloresGrafico, useTema } from '../lib/tema'
import {
  CHART_ACTIVE_BAR,
  CHART_BAR_BG,
  CHART_CURSOR_FILL,
  asRechartsTooltip,
  ChartTooltipBox,
  TooltipBarras7Dias,
  TooltipTopProductos,
  useIndiceBarraActiva,
} from '../components/CustomTooltip'

function resumenAlerta(nombres: string[], extraLabel?: string) {
  const vis = nombres.slice(0, 3)
  const extra = nombres.length - vis.length
  const lista = vis.join(', ')
  if (extra <= 0) return lista
  return extraLabel ? `${lista} +${extra} más ${extraLabel}` : `${lista} +${extra} más`
}

function BannerStock({
  texto,
  to,
  fondo,
  borde,
  color,
}: {
  texto: string
  to: string
  fondo: string
  borde: string
  color: string
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 text-sm"
      style={{
        background: fondo,
        border: `1px solid ${borde}`,
        borderRadius: 8,
        color,
      }}
    >
      <p className="min-w-0 flex-1 truncate" title={texto}>
        {texto}
      </p>
      <Link className="shrink-0 font-semibold whitespace-nowrap" style={{ color }} to={to}>
        Ver todos →
      </Link>
    </div>
  )
}

const DASH_VACIO: DashboardInicio = {
  hoy: { cantidad: 0, total: 0 },
  semana: 0,
  mes: 0,
  comprasMes: 0,
  topHoy: null,
  ultimos7: [],
  top5: [],
  stock: [],
  cumples: [],
  alertasStock: [],
}

function truncarHome(nombre: string, max: number) {
  const t = String(nombre ?? '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function formatoEjeHome(v: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const m = n / 1_000_000
    const s = Number.isInteger(m) ? String(m) : m.toFixed(1).replace(/\.0$/, '')
    return `${s}M`
  }
  if (abs >= 1000) return `${Math.round(n / 1000)}k`
  return String(Math.round(n))
}

const MARGIN_HOME = { top: 10, right: 10, bottom: 10, left: 10 } as const

const cardGraficoHome = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(99,102,241,0.3)',
} as const

const Grafico7Dias = memo(function Grafico7Dias({ data }: { data: DashboardInicio['ultimos7'] }) {
  const { tema } = useTema()
  const mobile = useEsMobile()
  const g = coloresGrafico(tema)
  const { activo, onMouseMove, onMouseLeave } = useIndiceBarraActiva()
  return (
    <ChartResponsive altoMobile={200} altoDesktop={280}>
      <BarChart
        data={data}
        margin={MARGIN_HOME}
        onMouseMove={onMouseMove as never}
        onMouseLeave={onMouseLeave}
      >
        <CartesianGrid stroke={g.grilla} vertical={false} />
        <XAxis dataKey="dia" {...propsEjeX(g.eje, data.length, mobile)} />
        <YAxis
          {...propsEjeY(g.eje, mobile)}
          width={mobile ? 40 : 48}
          tickFormatter={formatoEjeHome}
        />
        <Tooltip
          cursor={<Rectangle fill={CHART_CURSOR_FILL} />}
          content={asRechartsTooltip(TooltipBarras7Dias)}
        />
        <Bar
          dataKey="total"
          radius={[4, 4, 0, 0]}
          background={{ fill: CHART_BAR_BG }}
          activeBar={<Rectangle fill="#818CF8" radius={4} />}
        >
          {data.map((fila, i) => (
            <Cell
              key={`${fila.fecha}-${i}`}
              fill="#6366F1"
              fillOpacity={activo == null || activo === i ? 1 : 0.55}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartResponsive>
  )
})

const GraficoTop5 = memo(function GraficoTop5({
  data,
}: {
  data: { nombre: string; unidades: number; etiqueta: string }[]
}) {
  const { tema } = useTema()
  const g = coloresGrafico(tema)
  const { activo, onMouseMove, onMouseLeave } = useIndiceBarraActiva()
  const filas = data.map((p) => ({ ...p, etiqueta: truncarHome(p.nombre, 12) }))
  if (filas.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Todavía no hay ventas
      </p>
    )
  }
  return (
    <ChartResponsive altoMobile={200} altoDesktop={280}>
      <BarChart
        layout="vertical"
        data={filas}
        margin={{ top: 10, right: 36, bottom: 10, left: 10 }}
        barCategoryGap="28%"
        onMouseMove={onMouseMove as never}
        onMouseLeave={onMouseLeave}
      >
        <CartesianGrid stroke={g.grilla} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="etiqueta"
          width={96}
          interval={0}
          tick={{ fill: g.eje, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={<Rectangle fill={CHART_CURSOR_FILL} />} content={asRechartsTooltip(TooltipTopProductos)} />
        <Bar dataKey="unidades" radius={[0, 4, 4, 0]} background={{ fill: CHART_BAR_BG }} activeBar={<Rectangle fill="#86EFAC" />}>
          {filas.map((fila, i) => (
            <Cell key={`${fila.nombre}-${i}`} fill="#4ADE80" fillOpacity={activo == null || activo === i ? 1 : 0.55} />
          ))}
          <LabelList dataKey="unidades" position="right" fill="#4ADE80" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartResponsive>
  )
})

const GraficoStock = memo(function GraficoStock({
  data,
  gestionaStock,
}: {
  data: DashboardInicio['stock']
  gestionaStock: boolean
}) {
  const { tema } = useTema()
  const g = coloresGrafico(tema)
  const { activo, onMouseMove, onMouseLeave } = useIndiceBarraActiva()
  const top10 = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.stock - a.stock || a.nombre.localeCompare(b.nombre, 'es'))
        .slice(0, 10)
        .map((p) => ({ ...p, etiqueta: truncarHome(p.nombre, 10) })),
    [data],
  )
  const alto = Math.min(Math.max(top10.length, 1) * 32, 400)
  if (!gestionaStock) {
    return (
      <p className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Este negocio no gestiona stock por unidades
      </p>
    )
  }
  return (
    <ChartResponsive altoMobile={alto} altoDesktop={alto}>
      <BarChart
        layout="vertical"
        data={top10}
        margin={{ top: 8, right: 36, left: 8, bottom: 8 }}
        onMouseMove={onMouseMove as never}
        onMouseLeave={onMouseLeave}
      >
        <CartesianGrid stroke={g.grilla} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="etiqueta"
          width={84}
          interval={0}
          tick={{ fill: g.eje, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={<Rectangle fill={CHART_CURSOR_FILL} />}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as { nombre?: string; stock?: number }
            return (
              <ChartTooltipBox>
                <p style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600 }}>{p.nombre}</p>
                <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 6 }}>Stock: {Number(p.stock ?? 0)} u</p>
              </ChartTooltipBox>
            )
          }}
        />
        <Bar dataKey="stock" radius={[0, 4, 4, 0]} maxBarSize={18} background={{ fill: CHART_BAR_BG }} activeBar={<Rectangle fill={CHART_ACTIVE_BAR} />}>
          {top10.map((fila, i) => (
            <Cell
              key={`${fila.nombre}-${i}`}
              fill={fila.stock <= 0 ? '#F87171' : fila.stock <= 5 ? '#FCD34D' : '#4ADE80'}
              fillOpacity={activo == null || activo === i ? 1 : 0.55}
            />
          ))}
          <LabelList dataKey="stock" position="right" fill={g.eje} fontSize={11} />
        </Bar>
      </BarChart>
    </ChartResponsive>
  )
})

function KpiCardSkeleton() {
  return (
    <div
      className="flex min-h-[108px] flex-col justify-center rounded-lg p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="kpi-skeleton-bar" style={{ width: '60%', height: 14 }} />
      <div className="kpi-skeleton-bar mt-3" style={{ width: '80%', height: 32 }} />
      <div className="kpi-skeleton-bar mt-2" style={{ width: '40%', height: 12 }} />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <section className="mt-6" aria-busy="true" aria-label="Cargando dashboard">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <div className="col-span-2 w-full max-w-[calc(50%-0.375rem)] justify-self-center xl:col-span-1 xl:max-w-none xl:justify-self-auto">
          <KpiCardSkeleton />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div
          className="rounded-lg p-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="kpi-skeleton-bar" style={{ width: '45%', height: 14 }} />
          <div className="kpi-skeleton-bar mt-3 h-56" style={{ borderRadius: 8 }} />
        </div>
        <div
          className="rounded-lg p-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="kpi-skeleton-bar" style={{ width: '55%', height: 14 }} />
          <div className="kpi-skeleton-bar mt-3" style={{ height: 320, borderRadius: 8 }} />
        </div>
      </div>
    </section>
  )
}

function IconoBolsa() {
  return (
    <svg className="h-8 w-8" style={{ color: 'var(--kpi-sub)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 10-8 0v4M5 9h14l-1 11H6L5 9z" />
    </svg>
  )
}

function IconoCalendario() {
  return (
    <svg className="h-8 w-8" style={{ color: 'var(--kpi-sub)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function IconoMes() {
  return (
    <svg className="h-8 w-8" style={{ color: 'var(--kpi-sub)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h6m-6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14" />
    </svg>
  )
}

function IconoCompras() {
  return (
    <svg className="h-8 w-8" style={{ color: 'var(--kpi-sub)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-2 9m12-9l2 9M9 22a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  )
}

function IconoProducto() {
  return (
    <svg className="h-8 w-8" style={{ color: 'var(--kpi-sub)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
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
      className="min-h-[108px] rounded-lg p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--kpi-label)' }}>
            {label}
          </p>
          <p
            className={`mt-2 font-metric leading-tight ${
            wrap ? 'text-base break-words md:text-lg' : 'whitespace-nowrap text-[18px] md:text-[24px]'
            }`}
            style={{ color: 'var(--kpi-value)' }}
          >
            {valor}
          </p>
          {detalle ? (
            <p className="mt-1 text-xs" style={{ color: 'var(--kpi-sub)' }}>
              {detalle}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 hidden xl:block">{icono}</div>
      </div>
    </div>
  )
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
  if (abs >= 10_000) {
    return `${signo}$${Math.round(abs / 1000).toLocaleString('es-AR')} mil`
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor)
}

export function HomePage() {
  const { perfil, session, error, suscripcion } = useAuth()
  const { tema } = useTema()
  const cumpleFg = tema === 'light' ? '#92400E' : '#FCD34D'
  const [dash, setDash] = useState<DashboardInicio>(DASH_VACIO)
  const [serieHome, setSerieHome] = useState<DashboardInicio['ultimos7']>([])
  const [rangoHome, setRangoHome] = useState<RangoHome>(7)
  const [cargandoDash, setCargandoDash] = useState(true)
  const [bannerTicket, setBannerTicket] = useState<BannerTicketHome | null>(null)
  const [alertasLotes, setAlertasLotes] = useState({ vencidos: 0, porVencer: 0 })
  const [modalVencido, setModalVencido] = useState(false)

  useEffect(() => {
    if (!perfil) return
    const client = requireSupabase()
    void (async () => {
      setCargandoDash(true)
      const [dashData, serie] = await Promise.all([
        cargarDashboardInicio(client),
        cargarSerieVentasHome(client),
      ])
      setDash(dashData)
      console.log('[stock home]', dashData.stock.slice(0, 3))
      setSerieHome(serie.length > 0 ? serie : dashData.ultimos7)
      setCargandoDash(false)
      const banner = await bannerTicketsHome(client)
      setBannerTicket(banner)
      const cfg = await obtenerConfiguracion(client, perfil.empresa.id)
      if (cfg.config.usaLotes) {
        setAlertasLotes(await contarAlertasLotes(client))
      } else {
        setAlertasLotes({ vencidos: 0, porVencer: 0 })
      }
    })()
  }, [perfil])

  const datosGrafico7Dias = useMemo(
    () => procesarDatosGrafico(recortarSerieHome(serieHome, rangoHome)),
    [serieHome, rangoHome],
  )
  const datosTopProductos = useMemo(() => procesarTopProductos(dash.top5), [dash.top5])
  const alertasStock = useMemo(() => {
    const sin = dash.alertasStock.filter((p) => p.stock <= 0)
    const bajo = dash.alertasStock.filter((p) => p.stock > 0)
    return { sin, bajo }
  }, [dash.alertasStock])
  const stockHome = useMemo(() => {
    const gestiona = dash.stock.some((p) => p.stock !== 0)
    const n = Math.min(dash.stock.length, 10)
    return {
      gestionaStock: gestiona,
      alturaStock: Math.min(n * 32, 400),
    }
  }, [dash.stock])

  const dias = diasRestantes(suscripcion?.fecha_vencimiento ?? null)
  const trialActivo = estaEnTrial(suscripcion)
  const vencido = trialVencido(suscripcion)
  const precioLaunch = formatoPrecioPlan(precioLanzamiento('premium', 'mensual'))

  useEffect(() => {
    if (vencido) setModalVencido(true)
  }, [vencido])

  if (!perfil) return null

  const mostrarAdmin = esAdminEmail(session?.user.email ?? perfil.usuario.email)
  const verReportes = tienePermiso(perfil, 'ver_reportes')
  const nombrePlan = etiquetaPlan(perfil.empresa.plan_actual)

  return (
    <div
      className="relative min-h-dvh"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <ParticleNetwork startWhenIdle pauseOffscreen />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <AppNav />
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--nav-idle)' }}>
            Analítica 360
          </p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            {perfil.empresa.nombre}
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Hola, {perfil.usuario.nombre}
          </p>
        </header>

        {trialActivo && dias > 4 ? (
          <p className="mb-4 rounded-lg bg-indigo-500/15 px-3 py-2 text-sm font-semibold text-indigo-200">
            ⭐ Trial Premium — {dias} {dias === 1 ? 'día restante' : 'días restantes'}
          </p>
        ) : null}

        {trialActivo && dias > 1 && dias <= 4 ? (
          <div className="mb-4 rounded-lg bg-amber-100 px-3 py-3 text-sm text-amber-950">
            <p>
              ⏳ Tu trial vence en {dias} {dias === 1 ? 'día' : 'días'}
              <br />
              Activá tu plan ahora con 40% OFF los primeros {MESES_DESCUENTO_LANZAMIENTO} meses
            </p>
            <Link className="mt-2 inline-flex font-semibold text-[#4F46E5]" to="/planes">
              Ver planes
            </Link>
          </div>
        ) : null}

        {trialActivo && dias === 1 ? (
          <div className="mb-4 rounded-lg bg-red-100 px-3 py-3 text-sm text-red-900">
            🔴 Tu trial vence mañana — último día para el 40% OFF
            <Link className="mt-2 block font-semibold" to="/planes">
              Ver planes
            </Link>
          </div>
        ) : null}

        {vencido ? (
          <p className="mb-4 rounded-lg bg-red-100 px-3 py-3 text-sm text-red-900">
            Tu período de prueba venció — activá un plan para seguir usando Analytics, Insights y el resto de módulos
            premium.
          </p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}

        {bannerTicket ? (
          <Link
            className="mb-4 block rounded-lg px-3 py-3 text-sm"
            style={{
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.28)',
              color: 'var(--text)',
            }}
            to={bannerTicket.tipo === 'respuesta' ? `/soporte/${bannerTicket.id}` : '/soporte'}
          >
            {bannerTicket.tipo === 'respuesta'
              ? `💬 Tenés una respuesta nueva en ${bannerTicket.numero}`
              : `🎫 Tu ticket ${bannerTicket.numero} está siendo revisado`}
          </Link>
        ) : null}

        {alertasLotes.vencidos > 0 ? (
          <Link
            className="mb-4 block rounded-lg bg-red-100 px-3 py-3 text-sm text-red-900"
            to="/inventario?tab=lotes&estado=vencido"
          >
            🔴 {alertasLotes.vencidos} {alertasLotes.vencidos === 1 ? 'lote vencido' : 'lotes vencidos'}
          </Link>
        ) : null}

        {alertasLotes.porVencer > 0 ? (
          <Link
            className="mb-4 block rounded-lg bg-amber-100 px-3 py-3 text-sm text-amber-950"
            to="/inventario?tab=lotes&estado=por_vencer"
          >
            🟡 {alertasLotes.porVencer} {alertasLotes.porVencer === 1 ? 'lote vence' : 'lotes vencen'} en 30 días
          </Link>
        ) : null}

        {!verReportes && dash.cumples.length > 0 ? (
          <p
            className="mb-4 rounded-lg px-3 py-3 text-sm"
            style={{
              background: 'rgba(251,191,36,0.1)',
              border: `1px solid ${cumpleFg}`,
              color: cumpleFg,
              borderRadius: 8,
            }}
          >
            🎂 Cumpleaños próximos: {dash.cumples.map(textoCumpleProximo).join(', ')}
          </p>
        ) : null}

        {verReportes && cargandoDash ? <DashboardSkeleton /> : null}

        {verReportes && !cargandoDash ? (
          <section className="mt-6">
            <p className="mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              Plan {nombrePlan}
              {trialActivo ? ` · ${dias} ${dias === 1 ? 'día' : 'días'} de trial restantes` : null}
              {!planEsIlimitado(perfil.empresa.plan_actual) ? (
                <>
                  {' '}
                  ·{' '}
                  <Link className="font-semibold text-[#A5B4FC] hover:underline" to="/planes">
                    Actualizar plan
                  </Link>
                </>
              ) : null}
            </p>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
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
              <div className="col-span-2 w-full max-w-[calc(50%-0.375rem)] justify-self-center xl:col-span-1 xl:max-w-none xl:justify-self-auto">
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
            </div>

            {(() => {
              const { sin, bajo } = alertasStock
              if (sin.length === 0 && bajo.length === 0) return null
              const claro = tema === 'light'
              return (
                <div className="mt-4 space-y-2">
                  {sin.length > 0 ? (
                    <BannerStock
                      to="/productos?stock=sin"
                      texto={`⚠️ Sin stock (${sin.length} ${sin.length === 1 ? 'producto' : 'productos'}): ${resumenAlerta(
                        sin.map((p) => p.nombre),
                        'sin stock',
                      )}`}
                      fondo={claro ? '#FEE2E2' : 'rgba(248,113,113,0.1)'}
                      borde={claro ? '#EF4444' : '#F87171'}
                      color={claro ? '#991B1B' : '#F87171'}
                    />
                  ) : null}
                  {bajo.length > 0 ? (
                    <BannerStock
                      to="/productos?stock=bajo"
                      texto={`📦 Stock bajo (${bajo.length} ${bajo.length === 1 ? 'producto' : 'productos'}): ${resumenAlerta(
                        bajo.map((p) => `${p.nombre} (${p.stock}u)`),
                      )}`}
                      fondo={claro ? '#FEF9C3' : 'rgba(252,211,77,0.1)'}
                      borde={claro ? '#EAB308' : '#FCD34D'}
                      color={claro ? '#713F12' : '#FCD34D'}
                    />
                  ) : null}
                </div>
              )
            })()}

            {dash.cumples.length > 0 ? (
              <p
                className="mt-4 rounded-lg px-3 py-3 text-sm"
                style={{
                  background: 'rgba(251,191,36,0.1)',
                  border: `1px solid ${cumpleFg}`,
                  color: cumpleFg,
                  borderRadius: 8,
                }}
              >
                🎂 Cumpleaños próximos: {dash.cumples.map(textoCumpleProximo).join(', ')}
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="overflow-hidden rounded-lg p-4" style={cardGraficoHome}>
                <GraficoExpandible
                  titulo={
                    rangoHome === 7
                      ? 'Ventas últimos 7 días'
                      : rangoHome === 30
                        ? 'Ventas últimos 30 días'
                        : 'Ventas últimos 3 meses'
                  }
                  compactoClass="min-h-[200px] w-full overflow-hidden md:min-h-[280px]"
                  toolbar={
                    <SelectorChips
                      valor={String(rangoHome)}
                      opciones={[
                        { id: '7', label: '7 días' },
                        { id: '30', label: '30 días' },
                        { id: '90', label: '3 meses' },
                      ]}
                      onChange={(id) => setRangoHome(Number(id) as RangoHome)}
                    />
                  }
                >
                  <Grafico7Dias data={datosGrafico7Dias} />
                </GraficoExpandible>
              </div>

              <div className="overflow-hidden rounded-lg p-4" style={cardGraficoHome}>
                <GraficoExpandible titulo="Top 5 productos más vendidos" compactoClass="min-h-[200px] w-full overflow-hidden md:min-h-[280px]">
                  <GraficoTop5 data={datosTopProductos} />
                </GraficoExpandible>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg p-4" style={cardGraficoHome}>
              <GraficoExpandible
                titulo="Estado de stock — productos activos"
                compactoStyle={{ height: stockHome.gestionaStock ? stockHome.alturaStock : 160 }}
              >
                <GraficoStock data={dash.stock} gestionaStock={stockHome.gestionaStock} />
              </GraficoExpandible>
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
      <LimitePlanModal
        abierto={modalVencido}
        titulo="Tu trial venció"
        texto={`Los módulos premium quedaron bloqueados. Activá un plan desde ${precioLaunch}/mes los primeros ${MESES_DESCUENTO_LANZAMIENTO} meses.`}
        onCerrar={() => setModalVencido(false)}
      />
    </div>
  )
}
