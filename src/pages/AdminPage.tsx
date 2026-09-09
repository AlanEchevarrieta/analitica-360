import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ThemeToggle } from '../lib/tema'
import {
  asignarSuscripcionAdmin,
  cambiarEstadoSuscripcionAdmin,
  esAdminEmail,
  listarPlanesAdmin,
  listarSuscripcionesAdmin,
  marcarEmpresaDemoAdmin,
  type FilaAdminSuscripcion,
  type PlanAdmin,
} from '../lib/suscripcion'
import { claseBadgePlan, clavePlan, etiquetaPlan } from '../lib/planes'
import { listarPagosAdmin, registrarPagoAdmin, type AdminPagoFila } from '../lib/adminSaaS'
import { requireSupabase } from '../lib/supabase'
import { formatoARS } from '../lib/productos'

const ESTADOS = ['periodo_prueba', 'pendiente_pago', 'activa', 'vencida', 'cancelada'] as const

type PlanCantidadRpc = { plan: string; cantidad: number }

type AdminMetricsRpc = {
  mrr: number
  total_empresas: number
  activas: number
  en_prueba: number
  vencidas: number
  nuevas_este_mes: number
  nuevas_mes_anterior: number
  pagos_este_mes: number
  empresas_por_plan: PlanCantidadRpc[]
}

const METRICS_CERO: AdminMetricsRpc = {
  mrr: 0,
  total_empresas: 0,
  activas: 0,
  en_prueba: 0,
  vencidas: 0,
  nuevas_este_mes: 0,
  nuevas_mes_anterior: 0,
  pagos_este_mes: 0,
  empresas_por_plan: [],
}

function numMetric(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function parseAdminMetrics(data: unknown): AdminMetricsRpc {
  let row: Record<string, unknown> = {}
  if (typeof data === 'string') {
    try {
      row = JSON.parse(data) as Record<string, unknown>
    } catch (err) {
      console.error('[admin_saas_metrics] JSON inválido', err, data)
    }
  } else if (Array.isArray(data)) {
    row = (data[0] ?? {}) as Record<string, unknown>
  } else if (data && typeof data === 'object') {
    row = data as Record<string, unknown>
  }
  const planes = Array.isArray(row.empresas_por_plan) ? row.empresas_por_plan : []
  return {
    mrr: numMetric(row.mrr),
    total_empresas: numMetric(row.total_empresas),
    activas: numMetric(row.activas),
    en_prueba: numMetric(row.en_prueba),
    vencidas: numMetric(row.vencidas),
    nuevas_este_mes: numMetric(row.nuevas_este_mes),
    nuevas_mes_anterior: numMetric(row.nuevas_mes_anterior),
    pagos_este_mes: numMetric(row.pagos_este_mes),
    empresas_por_plan: planes.map((item) => {
      const p = item as Record<string, unknown>
      return { plan: String(p.plan ?? ''), cantidad: numMetric(p.cantidad) }
    }),
  }
}

function KpiAdmin({
  label,
  valor,
  detalle,
  icono,
  valorColor,
}: {
  label: string
  valor: string
  detalle?: ReactNode
  icono?: string
  valorColor?: string
}) {
  return (
    <div
      className="p-4"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 12,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium" style={{ color: 'var(--kpi-label)' }}>
          {label}
        </p>
        {icono ? <span className="text-base leading-none">{icono}</span> : null}
      </div>
      <p
        className="mt-2 break-words text-lg font-bold leading-tight sm:text-[24px]"
        style={{ color: valorColor ?? 'var(--kpi-value)' }}
      >
        {valor}
      </p>
      {detalle ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--kpi-sub)' }}>
          {detalle}
        </p>
      ) : null}
    </div>
  )
}

function fechaMasDias(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function AdminPage() {
  const { session, perfil, listo } = useAuth()
  const email = session?.user.email ?? perfil?.usuario.email
  const [filas, setFilas] = useState<FilaAdminSuscripcion[]>([])
  const [planes, setPlanes] = useState<PlanAdmin[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [asignandoId, setAsignandoId] = useState<string | null>(null)
  const [planElegido, setPlanElegido] = useState('')
  const [fechaElegida, setFechaElegida] = useState(fechaMasDias(14))
  const [tab, setTab] = useState<'empresas' | 'pagos'>('empresas')
  const [metrics, setMetrics] = useState<AdminMetricsRpc>(METRICS_CERO)
  const [pagos, setPagos] = useState<AdminPagoFila[]>([])
  const [filtroPagoEstado, setFiltroPagoEstado] = useState('')
  const [filtroPagoMes, setFiltroPagoMes] = useState('')
  const [modalPago, setModalPago] = useState(false)
  const [pagoEmpresa, setPagoEmpresa] = useState('')
  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoMetodo, setPagoMetodo] = useState('Transferencia')
  const [pagoPeriodo, setPagoPeriodo] = useState(() => new Date().toISOString().slice(0, 7))
  const [pagoNotas, setPagoNotas] = useState('')

  const planPorDefecto = useMemo(
    () => planes.find((p) => clavePlan(p.nombre) === 'starter')?.id ?? planes[0]?.id ?? '',
    [planes],
  )

  const planesSelect = useMemo(() => {
    const ids = new Set(['starter', 'basico', 'pro', 'premium'])
    const filtrados = planes.filter((p) => ids.has(clavePlan(p.nombre)))
    return filtrados.length ? filtrados : planes
  }, [planes])

  function planDeFila(fila: FilaAdminSuscripcion) {
    return fila.plan_actual || fila.plan_nombre
  }

  const cargar = useCallback(async () => {
    const client = requireSupabase()
    const [subs, listaPlanes, metsRpc] = await Promise.all([
      listarSuscripcionesAdmin(client),
      listarPlanesAdmin(client),
      client.rpc('admin_saas_metrics'),
    ])
    const { data: metricsData, error: metricsError } = metsRpc
    if (metricsError) {
      console.error('[admin_saas_metrics]', metricsError)
    }
    setFilas(subs.filas)
    setPlanes(listaPlanes)
    setMetrics(parseAdminMetrics(metricsData))
    setError(subs.error || metricsError?.message || null)
  }, [])

  const cargarPagos = useCallback(async () => {
    const { filas: data, error: fallo } = await listarPagosAdmin(requireSupabase(), {
      estado: filtroPagoEstado,
      periodo: filtroPagoMes,
    })
    if (fallo) setError(fallo)
    else setPagos(data)
  }, [filtroPagoEstado, filtroPagoMes])

  useEffect(() => {
    if (listo && esAdminEmail(email)) void cargar()
  }, [cargar, email, listo])

  useEffect(() => {
    if (listo && esAdminEmail(email) && tab === 'pagos') void cargarPagos()
  }, [cargarPagos, email, listo, tab])

  useEffect(() => {
    if (asignandoId && !planElegido && planPorDefecto) {
      setPlanElegido(planPorDefecto)
    }
  }, [asignandoId, planElegido, planPorDefecto])

  async function cambiarEstado(suscripcionId: string | null, estado: string) {
    if (!suscripcionId) return
    setGuardando(suscripcionId)
    const fallo = await cambiarEstadoSuscripcionAdmin(requireSupabase(), suscripcionId, estado)
    setGuardando(null)
    if (fallo) {
      setError(fallo)
      return
    }
    await cargar()
  }

  async function marcarDemo(fila: FilaAdminSuscripcion) {
    setGuardando(fila.empresa_id)
    const fallo = await marcarEmpresaDemoAdmin(requireSupabase(), fila.empresa_id, !fila.es_demo)
    setGuardando(null)
    if (fallo) {
      setError(fallo)
      return
    }
    await cargar()
  }

  async function guardarPago() {
    const monto = Number(pagoMonto.replace(',', '.'))
    if (!pagoEmpresa || !Number.isFinite(monto) || monto <= 0 || !pagoPeriodo) {
      setError('Completá empresa, monto y período')
      return
    }
    setGuardando('pago')
    const fallo = await registrarPagoAdmin(requireSupabase(), {
      empresaId: pagoEmpresa,
      monto,
      metodo: pagoMetodo,
      periodo: pagoPeriodo,
      notas: pagoNotas,
    })
    setGuardando(null)
    if (fallo) {
      setError(fallo)
      return
    }
    setModalPago(false)
    setPagoMonto('')
    setPagoNotas('')
    setError(null)
    await Promise.all([cargar(), cargarPagos()])
  }

  function abrirAsignar(fila: FilaAdminSuscripcion) {
    setAsignandoId(fila.empresa_id)
    const clave = clavePlan(planDeFila(fila))
    const match = planesSelect.find((p) => clavePlan(p.nombre) === clave)
    setPlanElegido(match?.id ?? planPorDefecto)
    setFechaElegida(fila.fecha_vencimiento?.slice(0, 10) ?? fechaMasDias(14))
  }

  async function guardarAsignacion(empresaId: string) {
    const planId = planElegido || planPorDefecto
    const fecha = fechaElegida.slice(0, 10)
    if (!planId || !fecha) {
      setError('Elegí un plan y una fecha de vencimiento')
      return
    }
    setGuardando(empresaId)
    const fallo = await asignarSuscripcionAdmin(requireSupabase(), {
      empresaId,
      planId,
      fechaVencimiento: fecha,
    })
    setGuardando(null)
    if (fallo) {
      setError(fallo)
      return
    }
    setError(null)
    setAsignandoId(null)
    await cargar()
  }

  if (!listo) {
    return <p className="p-8 text-center text-sm text-[#4A5568]">Cargando…</p>
  }

  if (!esAdminEmail(email)) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-dvh px-4 py-8" style={{ fontFamily: 'Inter, system-ui, sans-serif', background: 'var(--canvas-from)', color: 'var(--text)' }}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Admin · Analítica 360</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link className="text-sm" style={{ color: 'var(--nav-idle)' }} to="/">
              Volver
            </Link>
          </div>
        </div>
        {error ? <p className="mb-4 rounded-md bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}

        <div className="mb-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiAdmin
              label="MRR"
              icono="💰"
              valor={`$ ${metrics.mrr.toLocaleString('es-AR')} ARS/mes`}
              valorColor="#4ADE80"
            />
            <KpiAdmin
              label="Total empresas"
              valor={String(metrics.total_empresas)}
              detalle="registradas"
            />
            <KpiAdmin
              label="Activas"
              icono="✅"
              valor={String(metrics.activas)}
              valorColor="#4ADE80"
            />
            <KpiAdmin
              label="En prueba"
              icono="⏳"
              valor={String(metrics.en_prueba)}
              valorColor="#FCD34D"
            />
            <KpiAdmin
              label="Vencidas"
              icono="⚠️"
              valor={String(metrics.vencidas)}
              valorColor={metrics.vencidas > 0 ? '#F87171' : '#94A3B8'}
            />
            <KpiAdmin
              label="Nuevas este mes"
              valor={String(metrics.nuevas_este_mes)}
              detalle={
                <span>
                  <span
                    style={{
                      color:
                        metrics.nuevas_este_mes >= metrics.nuevas_mes_anterior
                          ? '#4ADE80'
                          : '#F87171',
                    }}
                  >
                    {metrics.nuevas_este_mes >= metrics.nuevas_mes_anterior ? '↑' : '↓'}
                  </span>{' '}
                  vs {metrics.nuevas_mes_anterior} mes anterior
                </span>
              }
            />
            <KpiAdmin
              label="Cobrado este mes"
              valor={`$ ${metrics.pagos_este_mes.toLocaleString('es-AR')}`}
              valorColor="#6366F1"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {metrics.empresas_por_plan.length === 0 ? (
              <span className="text-xs" style={{ color: 'var(--kpi-sub)' }}>
                Sin distribución por plan
              </span>
            ) : (
              metrics.empresas_por_plan.map((p) => (
                <span
                  key={p.plan}
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${claseBadgePlan(p.plan)}`}
                >
                  {p.plan}: {p.cantidad}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === 'empresas' ? 'bg-[#6366F1] text-white' : 'bg-white/10 text-[#A5B4FC]'}`}
            type="button"
            onClick={() => setTab('empresas')}
          >
            Empresas
          </button>
          <button
            className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === 'pagos' ? 'bg-[#6366F1] text-white' : 'bg-white/10 text-[#A5B4FC]'}`}
            type="button"
            onClick={() => setTab('pagos')}
          >
            Pagos
          </button>
        </div>

        {tab === 'pagos' ? (
          <div>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="text-xs">
                Estado
                <select
                  className="mt-1 block rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-sm text-[#1A2F4A]"
                  value={filtroPagoEstado}
                  onChange={(ev) => setFiltroPagoEstado(ev.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </label>
              <label className="text-xs">
                Mes
                <input
                  className="mt-1 block rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-sm text-[#1A2F4A]"
                  type="month"
                  value={filtroPagoMes}
                  onChange={(ev) => setFiltroPagoMes(ev.target.value)}
                />
              </label>
              <button
                className="h-9 rounded-md bg-[#6366F1] px-3 text-sm font-semibold text-white hover:bg-[#4F46E5]"
                type="button"
                onClick={() => setModalPago(true)}
              >
                Registrar pago manual
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg bg-white/95 text-[#1A2F4A]">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[#EEF2F6] text-xs uppercase tracking-wide text-[#4A5568]">
                  <tr>
                    <th className="px-3 py-3">Empresa</th>
                    <th className="px-3 py-3">Monto</th>
                    <th className="px-3 py-3">Método</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Período</th>
                    <th className="px-3 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id} className="border-t border-[#E2E8F0]">
                      <td className="px-3 py-3 font-medium">{p.empresa_nombre}</td>
                      <td className="px-3 py-3">{formatoARS(p.monto_ars)}</td>
                      <td className="px-3 py-3">{p.metodo}</td>
                      <td className="px-3 py-3">{p.estado}</td>
                      <td className="px-3 py-3">{p.periodo ?? '—'}</td>
                      <td className="px-3 py-3">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleDateString('es-AR')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pagos.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-[#4A5568]">No hay pagos con esos filtros.</p>
              ) : null}
            </div>
          </div>
        ) : (
        <div className="overflow-x-auto rounded-lg bg-white/95 text-[#1A2F4A]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#EEF2F6] text-xs uppercase tracking-wide text-[#4A5568]">
              <tr>
                <th className="px-3 py-3">Empresa</th>
                <th className="px-3 py-3">Es demo</th>
                <th className="px-3 py-3">Plan</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Vencimiento</th>
                <th className="px-3 py-3">Cambiar</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.empresa_id} className="border-t border-[#E2E8F0] align-top">
                  <td className="px-3 py-3 font-medium">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {fila.empresa_nombre}
                      {fila.es_demo ? (
                        <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
                          DEMO
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#4A5568]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#6366F1]"
                        checked={Boolean(fila.es_demo)}
                        disabled={guardando === fila.empresa_id}
                        onChange={() => void marcarDemo(fila)}
                      />
                      Demo
                    </label>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${claseBadgePlan(planDeFila(fila))}`}
                    >
                      {etiquetaPlan(planDeFila(fila))}
                    </span>
                  </td>
                  <td className="px-3 py-3">{fila.estado ?? 'sin suscripción'}</td>
                  <td className="px-3 py-3">{fila.fecha_vencimiento ?? '—'}</td>
                  <td className="px-3 py-3">
                    {asignandoId === fila.empresa_id ? (
                      <div className="flex min-w-[240px] flex-col gap-2">
                        <label className="text-xs font-medium text-[#4A5568]">Plan</label>
                        <select
                          className="rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-2 py-1"
                          value={planElegido || planPorDefecto}
                          onChange={(ev) => setPlanElegido(ev.target.value)}
                        >
                          {planesSelect.length === 0 ? <option value="">Sin planes</option> : null}
                          {planesSelect.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {etiquetaPlan(plan.nombre)}
                            </option>
                          ))}
                        </select>
                        <label className="text-xs font-medium text-[#4A5568]">Vencimiento</label>
                        <input
                          className="rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-2 py-1"
                          type="date"
                          value={fechaElegida}
                          onChange={(ev) => setFechaElegida(ev.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            className="rounded-md bg-[#6366F1] px-3 py-1 text-xs font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                            disabled={guardando === fila.empresa_id || !(planElegido || planPorDefecto)}
                            type="button"
                            onClick={() => void guardarAsignacion(fila.empresa_id)}
                          >
                            Guardar
                          </button>
                          <button
                            className="rounded-md border border-[#E2E8F0] px-3 py-1 text-xs text-[#4A5568]"
                            type="button"
                            onClick={() => setAsignandoId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {fila.suscripcion_id ? (
                          <select
                            className="rounded-md border border-[#CBD5E1] bg-[#EEF2F6] px-2 py-1"
                            value={fila.estado ?? 'periodo_prueba'}
                            disabled={guardando === fila.suscripcion_id}
                            onChange={(ev) => void cambiarEstado(fila.suscripcion_id, ev.target.value)}
                          >
                            {ESTADOS.map((estado) => (
                              <option key={estado} value={estado}>
                                {estado}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <button
                          className="rounded-md bg-[#6366F1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4F46E5]"
                          type="button"
                          onClick={() => abrirAsignar(fila)}
                        >
                          {fila.suscripcion_id ? 'Cambiar plan' : 'Asignar suscripción'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length === 0 && !error ? (
            <p className="px-3 py-6 text-center text-sm text-[#4A5568]">No hay empresas todavía.</p>
          ) : null}
        </div>
        )}

        {modalPago ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-[440px] rounded-lg bg-white p-6 text-[#1A2F4A] shadow-xl">
              <h2 className="text-lg font-bold">Registrar pago manual</h2>
              <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                Empresa
                <select
                  className="mt-1 h-10 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-2"
                  value={pagoEmpresa}
                  onChange={(ev) => setPagoEmpresa(ev.target.value)}
                >
                  <option value="">Elegí una empresa</option>
                  {filas.map((f) => (
                    <option key={f.empresa_id} value={f.empresa_id}>
                      {f.empresa_nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-sm font-medium text-[#4A5568]">
                Monto ARS
                <input
                  className="mt-1 h-10 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3"
                  inputMode="decimal"
                  value={pagoMonto}
                  onChange={(ev) => setPagoMonto(ev.target.value)}
                />
              </label>
              <label className="mt-3 block text-sm font-medium text-[#4A5568]">
                Método
                <select
                  className="mt-1 h-10 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-2"
                  value={pagoMetodo}
                  onChange={(ev) => setPagoMetodo(ev.target.value)}
                >
                  <option>Transferencia</option>
                  <option>Efectivo</option>
                  <option>Mercado Pago</option>
                </select>
              </label>
              <label className="mt-3 block text-sm font-medium text-[#4A5568]">
                Período que cubre
                <input
                  className="mt-1 h-10 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3"
                  type="month"
                  value={pagoPeriodo}
                  onChange={(ev) => setPagoPeriodo(ev.target.value)}
                />
              </label>
              <label className="mt-3 block text-sm font-medium text-[#4A5568]">
                Notas
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 py-2"
                  value={pagoNotas}
                  onChange={(ev) => setPagoNotas(ev.target.value)}
                />
              </label>
              <div className="mt-5 flex gap-2">
                <button
                  className="h-10 flex-1 rounded-md border border-[#E2E8F0] text-sm"
                  type="button"
                  onClick={() => setModalPago(false)}
                >
                  Cancelar
                </button>
                <button
                  className="h-10 flex-1 rounded-md bg-[#6366F1] text-sm font-semibold text-white disabled:opacity-50"
                  type="button"
                  disabled={guardando === 'pago'}
                  onClick={() => void guardarPago()}
                >
                  {guardando === 'pago' ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
