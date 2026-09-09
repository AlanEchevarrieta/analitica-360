import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ThemeToggle } from '../lib/tema'
import {
  asignarSuscripcionAdmin,
  cambiarEstadoSuscripcionAdmin,
  esAdminEmail,
  listarPlanesAdmin,
  listarSuscripcionesAdmin,
  type FilaAdminSuscripcion,
  type PlanAdmin,
} from '../lib/suscripcion'
import { claseBadgePlan, clavePlan, etiquetaPlan } from '../lib/planes'
import { requireSupabase } from '../lib/supabase'

const ESTADOS = ['periodo_prueba', 'pendiente_pago', 'activa', 'vencida', 'cancelada'] as const

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
    const [subs, listaPlanes] = await Promise.all([
      listarSuscripcionesAdmin(client),
      listarPlanesAdmin(client),
    ])
    if (subs.error) {
      setError(subs.error)
      return
    }
    setError(null)
    setFilas(subs.filas)
    setPlanes(listaPlanes)
  }, [])

  useEffect(() => {
    if (listo && esAdminEmail(email)) void cargar()
  }, [cargar, email, listo])

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
        <div className="overflow-x-auto rounded-lg bg-white/95 text-[#1A2F4A]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#EEF2F6] text-xs uppercase tracking-wide text-[#4A5568]">
              <tr>
                <th className="px-3 py-3">Empresa</th>
                <th className="px-3 py-3">Plan</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Vencimiento</th>
                <th className="px-3 py-3">Cambiar</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.empresa_id} className="border-t border-[#E2E8F0] align-top">
                  <td className="px-3 py-3 font-medium">{fila.empresa_nombre}</td>
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
      </div>
    </div>
  )
}
