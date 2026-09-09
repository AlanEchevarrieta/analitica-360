import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { PlanesModal } from '../components/PlanesModal'
import {
  FLUJO_VENTAS_DEFAULT,
  guardarConfiguracion,
  MEDIOS_PAGO,
  nuevaCuotaPersonalizada,
  obtenerConfiguracion,
  type FlujoVentas,
  type MedioPagoId,
  type MostrarClienteVenta,
  type TasaCuota,
} from '../lib/configuracion'
import {
  PERMISOS_CAMPOS,
  permisosPorRol,
  type Permisos,
} from '../lib/permisos'
import { evaluarPassword, passwordValida } from '../lib/password'
import { requireSupabase } from '../lib/supabase'
import {
  crearUsuarioEmpresa,
  desactivarUsuario,
  listarUsuariosEmpresa,
  type UsuarioEmpresa,
} from '../lib/usuarios'
import { etiquetaEstadoSuscripcion, etiquetaPlan } from '../lib/planes'
import { diasRestantes, leerSuscripcionActiva, type SuscripcionActiva } from '../lib/suscripcion'
import { theme } from '../theme'
import { btnPrimary, cardShell } from '../components/listado'

const inputClass =
  'h-10 w-full rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9] outline-none focus:border-[#6366F1]'

type TabId = 'medios' | 'cuotas' | 'usuarios' | 'flujo' | 'plan'

const TABS: { id: TabId; label: string }[] = [
  { id: 'medios', label: 'Medios de pago' },
  { id: 'cuotas', label: 'Cuotas y tasas' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'flujo', label: 'Flujo de ventas' },
  { id: 'plan', label: 'Mi Plan' },
]

const ICONO_MEDIO: Record<MedioPagoId, string> = {
  efectivo: '💵',
  transferencia: '🏦',
  debito: '💳',
  credito: '💳',
  mp_qr: '📱',
}

function Toggle({
  on,
  disabled,
  onChange,
}: {
  on: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        on ? 'bg-[#6366F1]' : 'bg-white/20'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      <span
        className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-[left] duration-200"
        style={{ left: on ? 23 : 3 }}
      />
    </button>
  )
}

export function ConfiguracionPage() {
  const { perfil } = useAuth()
  const [tab, setTab] = useState<TabId>('medios')
  const [medios, setMedios] = useState<MedioPagoId[]>([])
  const [tasas, setTasas] = useState<TasaCuota[]>([])
  const [flujo, setFlujo] = useState<FlujoVentas>({ ...FLUJO_VENTAS_DEFAULT })
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [invitar, setInvitar] = useState(false)
  const [nombreInv, setNombreInv] = useState('')
  const [emailInv, setEmailInv] = useState('')
  const [passwordInv, setPasswordInv] = useState('')
  const [rolInv, setRolInv] = useState<'operador' | 'visor'>('operador')
  const [permisosInv, setPermisosInv] = useState<Permisos>(permisosPorRol('operador'))
  const [enviandoInv, setEnviandoInv] = useState(false)
  const [suscripcion, setSuscripcion] = useState<SuscripcionActiva | null>(null)
  const [modalPlanes, setModalPlanes] = useState(false)

  async function cargarUsuarios() {
    const { filas, error: listError } = await listarUsuariosEmpresa(requireSupabase())
    if (listError) setError(listError)
    else setUsuarios(filas)
  }

  useEffect(() => {
    if (!perfil || perfil.usuario.rol !== 'dueno') return
    void (async () => {
      const { config, error: loadError } = await obtenerConfiguracion(
        requireSupabase(),
        perfil.empresa.id,
      )
      setMedios(config.mediosPago)
      setTasas(config.tasasCuotas)
      setFlujo(config.flujoVentas)
      if (loadError) setError(loadError)
      await cargarUsuarios()
      const sub = await leerSuscripcionActiva(requireSupabase(), perfil.empresa.id)
      setSuscripcion(sub)
      setCargando(false)
    })()
  }, [perfil])

  if (!perfil) return null
  if (perfil.usuario.rol !== 'dueno') return <Navigate to="/" replace />

  const creditoActivo = medios.includes('credito')

  function toggleMedio(id: MedioPagoId) {
    setOk(null)
    setMedios((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev
        return prev.filter((m) => m !== id)
      }
      return [...prev, id]
    })
  }

  function actualizarTasa(index: number, patch: Partial<TasaCuota>) {
    setOk(null)
    setTasas((prev) => prev.map((fila, i) => (i === index ? { ...fila, ...patch } : fila)))
  }

  async function onGuardar() {
    if (!perfil) return
    setError(null)
    setOk(null)
    if (medios.length === 0) {
      setError('Dejá al menos un medio de pago activo')
      return
    }
    const tasasValidas = tasas.map((fila) => {
      const tasa = Number(fila.tasa)
      const cuotas = Number(fila.cuotas)
      return {
        ...fila,
        cuotas: Number.isFinite(cuotas) && cuotas >= 0 ? cuotas : 0,
        tasa: Number.isFinite(tasa) && tasa >= 0 ? tasa : 0,
        personalizada: Boolean(fila.personalizada),
      }
    })
    setGuardando(true)
    const fallo = await guardarConfiguracion(requireSupabase(), {
      empresaId: perfil.empresa.id,
      mediosPago: medios,
      tasasCuotas: tasasValidas,
      flujoVentas: flujo,
    })
    setGuardando(false)
    if (fallo) {
      setError(
        fallo.includes('flujo de ventas')
          ? fallo
          : 'No se pudo guardar. Corré supabase/009_configuracion_empresa.sql en el SQL Editor.',
      )
      return
    }
    setTasas(tasasValidas)
    setOk('Configuración guardada')
  }

  async function onDesactivar(id: string) {
    setError(null)
    setOk(null)
    const fallo = await desactivarUsuario(requireSupabase(), id)
    if (fallo) {
      setError(fallo)
      return
    }
    setOk('Usuario desactivado')
    await cargarUsuarios()
  }

  async function onCrearUsuario() {
    setError(null)
    setOk(null)
    if (!nombreInv.trim() || !emailInv.trim()) {
      setError('Completá nombre y email')
      return
    }
    if (!passwordValida(evaluarPassword(passwordInv))) {
      setError('La contraseña temporal debe tener 12 caracteres, mayúscula, minúscula, número y un especial')
      return
    }
    setEnviandoInv(true)
    const fallo = await crearUsuarioEmpresa(requireSupabase(), {
      nombre: nombreInv.trim(),
      email: emailInv.trim(),
      password: passwordInv,
      rol: rolInv,
      permisos: permisosInv,
    })
    setEnviandoInv(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setOk('Usuario creado. Pasale el email y la contraseña temporal.')
    setInvitar(false)
    setNombreInv('')
    setEmailInv('')
    setPasswordInv('')
    setRolInv('operador')
    setPermisosInv(permisosPorRol('operador'))
    await cargarUsuarios()
  }

  function etiquetaRol(rol: string) {
    if (rol === 'dueno') return 'Dueño'
    if (rol === 'visor') return 'Visor'
    return 'Operador'
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
      <div className="relative z-10 mx-auto max-w-[440px] px-4 py-8">
        <AppNav />
        <div className="p-6 backdrop-blur-xl" style={cardShell}>
          <h1 className="text-[28px] font-semibold" style={{ fontFamily: theme.fontDisplay, color: 'var(--text)' }}>
            Configuración
          </h1>
          <p className="mt-1 text-[13px]" style={{ fontFamily: theme.fontSubtitle, color: 'var(--text-muted)' }}>
            {perfil.empresa.nombre}
          </p>

          <div className="mt-6 flex flex-nowrap gap-1 overflow-x-auto pb-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap ${
                  tab === item.id ? 'bg-[#6366F1] text-white' : 'bg-transparent text-[#94A3B8]'
                }`}
                onClick={() => {
                  setTab(item.id)
                  setError(null)
                  setOk(null)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {cargando ? (
            <p className="mt-6 text-sm text-[#94A3B8]">Cargando…</p>
          ) : (
            <>
              {tab === 'medios' ? (
                <ul className="mt-6 space-y-3">
                  {MEDIOS_PAGO.map((medio) => {
                    const activo = medios.includes(medio.id)
                    return (
                      <li
                        key={medio.id}
                        className={`medio-pago-card flex items-center justify-between rounded-xl border px-3 py-3 ${
                          activo ? '' : 'is-off'
                        }`}
                        style={{ borderColor: 'rgba(99,102,241,0.15)', background: 'rgba(15,23,41,0.45)' }}
                      >
                        <span className="medio-pago-nombre text-sm font-medium text-[#F1F5F9]">
                          {ICONO_MEDIO[medio.id]} {medio.label}
                        </span>
                        <Toggle on={activo} onChange={() => toggleMedio(medio.id)} />
                      </li>
                    )
                  })}
                </ul>
              ) : null}

              {tab === 'cuotas' ? (
                <div className="mt-6">
                  {!creditoActivo ? (
                    <p className="text-sm text-[#94A3B8]">
                      Activá Tarjeta Crédito en Medios de pago para usar estas tasas.
                    </p>
                  ) : null}
                  <div className={`grid grid-cols-[1fr_72px_36px_28px] gap-1 px-1 text-xs font-medium text-[#94A3B8] ${creditoActivo ? '' : 'mt-3 opacity-60'}`}>
                    <span>Cuotas</span>
                    <span>Coef. %</span>
                    <span className="text-center">Activo</span>
                    <span />
                  </div>
                  <ul className={`mt-2 space-y-2 ${creditoActivo ? '' : 'opacity-60'}`}>
                    {tasas.map((fila, index) => (
                      <li
                        key={`cuota-${index}`}
                        className="grid grid-cols-[1fr_72px_36px_28px] items-center gap-1 rounded-xl border border-[rgba(99,102,241,0.15)] px-2 py-2"
                      >
                        {fila.personalizada ? (
                          <input
                            className={inputClass}
                            inputMode="numeric"
                            disabled={!creditoActivo}
                            value={fila.cuotas}
                            onChange={(ev) => {
                              const n = Number.parseInt(ev.target.value, 10)
                              const cuotas = Number.isFinite(n) && n >= 0 ? n : 0
                              actualizarTasa(index, {
                                cuotas,
                                label: cuotas === 0 ? 'Plan Z' : `${cuotas} cuotas`,
                              })
                            }}
                          />
                        ) : (
                          <span className="text-sm text-[#F1F5F9]">{fila.label}</span>
                        )}
                        <input
                          className={inputClass}
                          inputMode="decimal"
                          disabled={!creditoActivo}
                          value={String(fila.tasa)}
                          onChange={(ev) => {
                            const n = Number(ev.target.value.replace(',', '.'))
                            actualizarTasa(index, { tasa: Number.isFinite(n) && n >= 0 ? n : 0 })
                          }}
                        />
                        <label className="flex justify-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#6366F1]"
                            disabled={!creditoActivo}
                            checked={fila.activo}
                            onChange={(ev) => actualizarTasa(index, { activo: ev.target.checked })}
                          />
                        </label>
                        {fila.personalizada ? (
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center text-[#DC2626] disabled:opacity-40"
                            disabled={!creditoActivo}
                            aria-label="Eliminar cuota"
                            onClick={() => {
                              setOk(null)
                              setTasas((prev) => prev.filter((_, i) => i !== index))
                            }}
                          >
                            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                              <path d="M7 2h6l.5 1.5H17v1.5H3V3.5h3.5L7 2zm1 5h1.5v8H8V7zm3.5 0H13v8h-1.5V7zM5.5 6h9l-.7 10.2A1.5 1.5 0 0 1 12.3 17.5H7.7a1.5 1.5 0 0 1-1.5-1.3L5.5 6z" />
                            </svg>
                          </button>
                        ) : (
                          <span />
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    className="mt-3 h-10 w-full rounded-lg border border-[rgba(99,102,241,0.3)] text-sm font-semibold text-[#A5B4FC] disabled:opacity-40"
                    type="button"
                    disabled={!creditoActivo}
                    onClick={() => {
                      setOk(null)
                      setTasas((prev) => [...prev, nuevaCuotaPersonalizada()])
                    }}
                  >
                    + Agregar cuota personalizada
                  </button>
                </div>
              ) : null}

              {tab === 'usuarios' ? (
                <div className="mt-6">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[#F1F5F9]">Usuarios</p>
                    <button
                      className="h-9 rounded-lg bg-[#6366F1] px-3 text-xs font-semibold text-white hover:bg-[#4F46E5]"
                      type="button"
                      onClick={() => {
                        setInvitar((v) => !v)
                        setError(null)
                        setOk(null)
                      }}
                    >
                      {invitar ? 'Cerrar' : '+ Agregar usuario'}
                    </button>
                  </div>

                  {invitar ? (
                    <div className="mt-3 space-y-3 rounded-xl border border-[rgba(99,102,241,0.15)] p-3">
                      <label className="block text-sm font-medium text-[#94A3B8]">
                        Nombre
                        <input
                          className={`${inputClass} mt-1`}
                          value={nombreInv}
                          onChange={(ev) => setNombreInv(ev.target.value)}
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#94A3B8]">
                        Email
                        <input
                          className={`${inputClass} mt-1`}
                          type="email"
                          value={emailInv}
                          onChange={(ev) => setEmailInv(ev.target.value)}
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#94A3B8]">
                        Contraseña temporal
                        <input
                          className={`${inputClass} mt-1`}
                          type="text"
                          autoComplete="new-password"
                          value={passwordInv}
                          onChange={(ev) => setPasswordInv(ev.target.value)}
                        />
                      </label>
                      <p className="text-xs text-[#94A3B8]">
                        Comunicásela al empleado por WhatsApp u otro medio. Pedile que la cambie
                        después desde Inicio.
                      </p>
                      <p className="text-sm font-medium text-[#94A3B8]">Rol</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(['operador', 'visor'] as const).map((rol) => (
                          <button
                            key={rol}
                            type="button"
                            className={`rounded-md border px-3 py-2 text-sm ${
                              rolInv === rol
                                ? 'border-[#6366F1] bg-[rgba(99,102,241,0.2)] font-semibold text-[#F1F5F9]'
                                : 'border-[rgba(99,102,241,0.15)] text-[#94A3B8]'
                            }`}
                            onClick={() => {
                              setRolInv(rol)
                              setPermisosInv(permisosPorRol(rol))
                            }}
                          >
                            {rol === 'operador' ? 'Operador' : 'Visor'}
                          </button>
                        ))}
                      </div>
                      <p className="text-sm font-medium text-[#94A3B8]">Permisos</p>
                      <ul className="space-y-2">
                        {PERMISOS_CAMPOS.map((campo) => (
                          <li key={campo.clave}>
                            <label className="flex items-start gap-2 text-sm text-[#F1F5F9]">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 accent-[#6366F1]"
                                checked={permisosInv[campo.clave]}
                                onChange={(ev) =>
                                  setPermisosInv((prev) => ({
                                    ...prev,
                                    [campo.clave]: ev.target.checked,
                                  }))
                                }
                              />
                              <span>
                                {campo.label}
                                {campo.nota ? (
                                  <span className="block text-xs text-[#94A3B8]">{campo.nota}</span>
                                ) : null}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <button
                        className="h-10 w-full rounded-lg bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                        type="button"
                        disabled={enviandoInv}
                        onClick={() => void onCrearUsuario()}
                      >
                        {enviandoInv ? 'GUARDANDO…' : 'Crear usuario'}
                      </button>
                    </div>
                  ) : null}

                  <ul className="mt-3 space-y-2">
                    {usuarios.map((u) => (
                      <li key={u.id} className="rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-[#F1F5F9]">{u.nombre}</p>
                            <p className="text-xs text-[#94A3B8]">{u.email}</p>
                            <p className="mt-1 text-xs text-[#94A3B8]">
                              {etiquetaRol(u.rol)} · {u.activo ? 'activo' : 'inactivo'}
                            </p>
                          </div>
                          {u.rol !== 'dueno' && u.activo ? (
                            <button
                              className="text-xs font-semibold text-[#DC2626]"
                              type="button"
                              onClick={() => void onDesactivar(u.id)}
                            >
                              Desactivar
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {tab === 'flujo' ? (
                <div className="mt-6 space-y-5">
                  <div>
                    <p className="text-sm font-medium text-[#F1F5F9]">Campo cliente en nueva venta</p>
                    <ul className="mt-3 space-y-2">
                      {(
                        [
                          { id: 'siempre' as const, label: 'Siempre mostrar', nota: 'Aparece y es obligatorio' },
                          { id: 'opcional' as const, label: 'Opcional', nota: 'Aparece pero se puede saltear' },
                          { id: 'no_mostrar' as const, label: 'No mostrar', nota: 'El campo no aparece en la venta' },
                        ] satisfies { id: MostrarClienteVenta; label: string; nota: string }[]
                      ).map((op) => (
                        <li key={op.id}>
                          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-3">
                            <input
                              className="mt-1"
                              type="radio"
                              name="mostrar-cliente"
                              checked={flujo.mostrarCliente === op.id}
                              onChange={() => {
                                setOk(null)
                                setFlujo((prev) => ({ ...prev, mostrarCliente: op.id }))
                              }}
                            />
                            <span>
                              <span className="block text-sm font-medium text-[#F1F5F9]">{op.label}</span>
                              <span className="mt-0.5 block text-xs text-[#94A3B8]">{op.nota}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#F1F5F9]">Permitir crear clientes desde la venta</p>
                      <p className="mt-0.5 text-xs text-[#94A3B8]">Si está en No, solo se pueden elegir clientes existentes.</p>
                    </div>
                    <Toggle
                      on={flujo.crearDesdeVenta}
                      onChange={() => {
                        setOk(null)
                        setFlujo((prev) => ({ ...prev, crearDesdeVenta: !prev.crearDesdeVenta }))
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {tab === 'plan' ? (
                <div className="mt-6 space-y-3 text-sm">
                  <div className="rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-3">
                    <p className="text-xs font-medium text-[#94A3B8]">Plan actual</p>
                    <p className="mt-1 font-semibold text-[#F1F5F9]">
                      {etiquetaPlan(perfil.empresa.plan_actual)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-3">
                    <p className="text-xs font-medium text-[#94A3B8]">Vencimiento</p>
                    <p className="mt-1 font-semibold text-[#F1F5F9]">
                      {suscripcion?.fecha_vencimiento ?? '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-3">
                    <p className="text-xs font-medium text-[#94A3B8]">Estado</p>
                    <p className="mt-1 font-semibold text-[#F1F5F9]">
                      {etiquetaEstadoSuscripcion(suscripcion?.estado, suscripcion?.fecha_vencimiento ?? null)}
                    </p>
                  </div>
                  {suscripcion?.estado === 'periodo_prueba' ? (
                    <div className="rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-3">
                      <p className="text-xs font-medium text-[#94A3B8]">Días restantes de prueba</p>
                      <p className="mt-1 font-semibold text-[#F1F5F9]">
                        {diasRestantes(suscripcion.fecha_vencimiento ?? null)}
                      </p>
                    </div>
                  ) : null}
                  <button
                    className={`${btnPrimary} mt-2 w-full`}
                    type="button"
                    onClick={() => setModalPlanes(true)}
                  >
                    Ver planes disponibles
                  </button>
                </div>
              ) : null}

              {error ? (
                <p className="mt-6 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
              ) : null}
              {ok ? (
                <p className="mt-6 rounded-xl bg-green-950/50 px-3 py-2 text-sm text-green-200">{ok}</p>
              ) : null}

              {tab === 'medios' || tab === 'cuotas' || tab === 'flujo' ? (
                <button
                  className={`${btnPrimary} mt-6 w-full`}
                  type="button"
                  disabled={guardando}
                  onClick={() => void onGuardar()}
                >
                  {guardando ? 'GUARDANDO…' : 'Guardar configuración'}
                </button>
              ) : null}
            </>
          )}

          <Link className="mt-6 block text-center text-sm font-medium text-[#A5B4FC]" to="/">
            Volver al inicio
          </Link>
        </div>
      </div>
      <PlanesModal abierto={modalPlanes} onCerrar={() => setModalPlanes(false)} />
    </div>
  )
}
