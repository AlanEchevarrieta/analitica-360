import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
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
  type ModoAsignacion,
  type MostrarClienteVenta,
  type TasaCuota,
} from '../lib/configuracion'
import { requireSupabase } from '../lib/supabase'
import {
  desactivarUsuario,
  guardarPermisosColaborador,
  invitarColaborador,
  listarUsuariosEmpresa,
  type UsuarioEmpresa,
} from '../lib/usuarios'
import { esDueno, linkInvitacionColaborador, textoLinkInvitacion } from '../lib/roles'
import { PermisosChecklist } from '../components/PermisosChecklist'
import {
  accesoSoloPedidos,
  detectarPreset,
  type AccesoColaborador,
  type PresetPermiso,
} from '../lib/permisos'
import { etiquetaEstadoSuscripcion, etiquetaPlan } from '../lib/planes'
import { diasRestantes, leerSuscripcionActiva, type SuscripcionActiva } from '../lib/suscripcion'
import { theme } from '../theme'
import {
  atributoTieneVariantesActivas,
  eliminarAtributo,
  guardarAtributo,
  listarAtributos,
  sembrarAtributosDefault,
  type AtributoFila,
} from '../lib/variantes'
import {
  eliminarCategoria,
  guardarCategoria,
  listarCategorias,
  sembrarCategoriasDefault,
  type CategoriaFila,
} from '../lib/categorias'
import {
  TIPOS_UBICACION,
  eliminarUbicacion,
  etiquetaTipoUbicacion,
  guardarUbicacion,
  listarUbicaciones,
  type TipoUbicacion,
  type UbicacionFila,
} from '../lib/ubicaciones'
import { btnPrimary, cardShell } from '../components/listado'

const inputClass =
  'h-10 w-full rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9] outline-none focus:border-[#6366F1]'

type TabId =
  | 'medios'
  | 'categorias'
  | 'cuotas'
  | 'usuarios'
  | 'flujo'
  | 'inventario'
  | 'ubicaciones'
  | 'variantes'
  | 'lotes'
  | 'remitente'
  | 'plan'

const MOSAICO: {
  id: TabId
  icono: string
  titulo: string
  subtitulo: string
}[] = [
  { id: 'medios', icono: '💳', titulo: 'Medios de pago', subtitulo: 'Configurá cómo aceptás pagos' },
  { id: 'cuotas', icono: '📊', titulo: 'Cuotas y tasas', subtitulo: 'Configurá los intereses por cuotas' },
  { id: 'categorias', icono: '🏷️', titulo: 'Categorías', subtitulo: 'Organizá tus productos' },
  { id: 'variantes', icono: '🎨', titulo: 'Variantes', subtitulo: 'Color, talle, material y más' },
  { id: 'lotes', icono: '📅', titulo: 'Lotes y Vencimientos', subtitulo: 'Stock por lote y fechas de vencimiento' },
  { id: 'usuarios', icono: '👥', titulo: 'Equipo — Usuarios y colaboradores', subtitulo: 'Invitá al equipo y asigná permisos' },
  { id: 'flujo', icono: '💸', titulo: 'Flujo de ventas', subtitulo: 'Configurá el proceso de venta' },
  { id: 'inventario', icono: '📦', titulo: 'Inventario', subtitulo: 'Umbral de stock bajo y alertas' },
  { id: 'ubicaciones', icono: '📍', titulo: 'Ubicaciones', subtitulo: 'Depósitos, locales y stands' },
  { id: 'remitente', icono: '📬', titulo: 'Datos del remitente', subtitulo: 'Quién figura en el remito' },
  { id: 'plan', icono: '⭐', titulo: 'Mi Plan', subtitulo: 'Plan actual y facturación' },
]

const TABS: { id: TabId; label: string }[] = MOSAICO.map((c) => ({ id: c.id, label: c.titulo }))

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
        className="absolute top-[3px] left-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform duration-200 will-change-transform"
        style={{ transform: on ? 'translate3d(20px, 0, 0)' : 'translate3d(0, 0, 0)' }}
      />
    </button>
  )
}

export function ConfiguracionPage() {
  const { perfil } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState<TabId | null>(
    TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : null,
  )
  const [medios, setMedios] = useState<MedioPagoId[]>([])
  const [tasas, setTasas] = useState<TasaCuota[]>([])
  const [flujo, setFlujo] = useState<FlujoVentas>({ ...FLUJO_VENTAS_DEFAULT })
  const [umbralStock, setUmbralStock] = useState('5')
  const [usaVariantes, setUsaVariantes] = useState(false)
  const [usaLotes, setUsaLotes] = useState(false)
  const [avisoLotes, setAvisoLotes] = useState(false)
  const [atributos, setAtributos] = useState<AtributoFila[]>([])
  const [altaAtributo, setAltaAtributo] = useState(false)
  const [editAtributo, setEditAtributo] = useState<AtributoFila | null>(null)
  const [nombreAtr, setNombreAtr] = useState('')
  const [valoresAtr, setValoresAtr] = useState<string[]>([])
  const [chipAtr, setChipAtr] = useState('')
  const [activoVentasAtr, setActivoVentasAtr] = useState(true)
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [invitar, setInvitar] = useState(false)
  const [emailInv, setEmailInv] = useState('')
  const [accesoInv, setAccesoInv] = useState<AccesoColaborador>(() => accesoSoloPedidos())
  const [presetInv, setPresetInv] = useState<PresetPermiso>('pedidos')
  const [enviandoInv, setEnviandoInv] = useState(false)
  const [linkInv, setLinkInv] = useState<{ url: string; texto: string } | null>(null)
  const [editUser, setEditUser] = useState<UsuarioEmpresa | null>(null)
  const [accesoEdit, setAccesoEdit] = useState<AccesoColaborador>(() => accesoSoloPedidos())
  const [presetEdit, setPresetEdit] = useState<PresetPermiso>('personalizado')
  const [guardandoPerm, setGuardandoPerm] = useState(false)
  const [suscripcion, setSuscripcion] = useState<SuscripcionActiva | null>(null)
  const [modalPlanes, setModalPlanes] = useState(false)
  const [categorias, setCategorias] = useState<CategoriaFila[]>([])
  const [altaCat, setAltaCat] = useState(false)
  const [editCat, setEditCat] = useState<CategoriaFila | null>(null)
  const [nombreCat, setNombreCat] = useState('')
  const [descCat, setDescCat] = useState('')
  const [activoCat, setActivoCat] = useState(true)
  const [ubicacionesCfg, setUbicacionesCfg] = useState<UbicacionFila[]>([])
  const [altaUbic, setAltaUbic] = useState(false)
  const [editUbic, setEditUbic] = useState<UbicacionFila | null>(null)
  const [nombreUbic, setNombreUbic] = useState('')
  const [descUbic, setDescUbic] = useState('')
  const [tipoUbic, setTipoUbic] = useState<TipoUbicacion>('otro')
  const [activoUbic, setActivoUbic] = useState(true)
  const [ubicacionVentaDefault, setUbicacionVentaDefault] = useState('')
  const [remitenteNombre, setRemitenteNombre] = useState('')
  const [remitenteDireccion, setRemitenteDireccion] = useState('')
  const [remitenteTelefono, setRemitenteTelefono] = useState('')
  const [remitenteEmail, setRemitenteEmail] = useState('')
  const [modoAsignacion, setModoAsignacion] = useState<ModoAsignacion>('manual')
  const [asignacionFija, setAsignacionFija] = useState('')
  const [rotacionIds, setRotacionIds] = useState<string[]>([])

  async function recargarCategorias() {
    const seed = await sembrarCategoriasDefault(requireSupabase())
    if (seed) setError(seed)
    const res = await listarCategorias(requireSupabase())
    if (res.error) setError(res.error)
    else setCategorias(res.filas)
  }

  function resetFormCategoria() {
    setAltaCat(false)
    setEditCat(null)
    setNombreCat('')
    setDescCat('')
    setActivoCat(true)
  }

  async function recargarUbicaciones() {
    const res = await listarUbicaciones(requireSupabase(), { soloActivas: false })
    if (res.error) setError(res.error)
    else setUbicacionesCfg(res.filas)
  }

  function resetFormUbicacion() {
    setAltaUbic(false)
    setEditUbic(null)
    setNombreUbic('')
    setDescUbic('')
    setTipoUbic('otro')
    setActivoUbic(true)
  }

  async function cargarUsuarios() {
    const { filas, error: listError } = await listarUsuariosEmpresa(requireSupabase())
    if (listError) setError(listError)
    else setUsuarios(filas)
  }

  useEffect(() => {
    if (!perfil || !esDueno(perfil.usuario.rol)) return
    void (async () => {
      const { config, error: loadError } = await obtenerConfiguracion(
        requireSupabase(),
        perfil.empresa.id,
      )
      setMedios(config.mediosPago)
      setTasas(config.tasasCuotas)
      setFlujo(config.flujoVentas)
      setUmbralStock(String(config.umbralStockBajo ?? 5))
      setUsaVariantes(Boolean(config.usaVariantes))
      setUsaLotes(Boolean(config.usaLotes))
      setUbicacionVentaDefault(config.ubicacionVentaDefault)
      setRemitenteNombre(config.remitenteNombre)
      setRemitenteDireccion(config.remitenteDireccion)
      setRemitenteTelefono(config.remitenteTelefono)
      setRemitenteEmail(config.remitenteEmail)
      setModoAsignacion(config.modoAsignacion)
      setAsignacionFija(config.asignacionFijaUsuarioId)
      setRotacionIds(config.asignacionRotacionIds)
      if (config.usaVariantes) {
        const atr = await listarAtributos(requireSupabase())
        if (!atr.error) setAtributos(atr.filas)
      }
      if (loadError) setError(loadError)
      await cargarUsuarios()
      const sub = await leerSuscripcionActiva(requireSupabase(), perfil.empresa.id)
      setSuscripcion(sub)
      setCargando(false)
    })()
  }, [perfil])

  useEffect(() => {
    if (!perfil || tab !== 'categorias') return
    void recargarCategorias()
  }, [perfil, tab])

  useEffect(() => {
    if (!perfil || tab !== 'ubicaciones') return
    void recargarUbicaciones()
  }, [perfil, tab])

  if (!perfil) return null
  if (!esDueno(perfil.usuario.rol)) return <Navigate to="/inicio" replace />
  const mosaicoVisible = MOSAICO.filter((c) => c.id !== 'plan' || esDueno(perfil.usuario.rol))

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
    if (modoAsignacion === 'todo_a_uno' && !asignacionFija) {
      setError('Elegí a quién asignar todos los pedidos')
      return
    }
    setGuardando(true)
    const fallo = await guardarConfiguracion(requireSupabase(), {
      empresaId: perfil.empresa.id,
      mediosPago: medios,
      tasasCuotas: tasasValidas,
      flujoVentas: flujo,
      umbralStockBajo: Number.parseInt(umbralStock, 10),
      usaVariantes,
      usaLotes,
      ubicacionVentaDefault,
      remitenteNombre,
      remitenteDireccion,
      remitenteTelefono,
      remitenteEmail,
      modoAsignacion,
      asignacionFijaUsuarioId: asignacionFija,
      asignacionRotacionIds: rotacionIds,
    })
    setGuardando(false)
    if (fallo) {
      setError(
        fallo.includes('flujo de ventas') || fallo.includes('asignación automática')
          ? fallo
          : 'No se pudo guardar. Corré supabase/009_configuracion_empresa.sql en el SQL Editor.',
      )
      return
    }
    setTasas(tasasValidas)
    setOk('Configuración guardada')
  }

  async function recargarAtributos() {
    const atr = await listarAtributos(requireSupabase())
    if (atr.error) setError(atr.error)
    else setAtributos(atr.filas)
  }

  async function toggleUsaVariantes() {
    if (!perfil) return
    setOk(null)
    setError(null)
    const next = !usaVariantes
    if (next) {
      const seed = await sembrarAtributosDefault(requireSupabase(), perfil.empresa.id)
      if (seed) {
        setError(seed)
        return
      }
      await recargarAtributos()
    }
    setUsaVariantes(next)
  }

  function toggleUsaLotes() {
    setOk(null)
    setError(null)
    const next = !usaLotes
    setUsaLotes(next)
    if (next) setAvisoLotes(true)
  }

  function resetFormAtributo() {
    setAltaAtributo(false)
    setEditAtributo(null)
    setNombreAtr('')
    setValoresAtr([])
    setChipAtr('')
    setActivoVentasAtr(true)
  }

  async function onGuardarAtributo() {
    if (!perfil) return
    setError(null)
    setOk(null)
    const extra = chipAtr.trim()
    const valores = extra ? [...valoresAtr, extra] : valoresAtr
    const fallo = await guardarAtributo(requireSupabase(), {
      id: editAtributo?.id,
      empresaId: perfil.empresa.id,
      nombre: nombreAtr,
      valores,
      activoVentas: activoVentasAtr,
    })
    if (fallo) {
      setError(fallo)
      return
    }
    resetFormAtributo()
    setOk('Atributo guardado')
    await recargarAtributos()
  }

  async function onDesactivar(u: UsuarioEmpresa) {
    setError(null)
    setOk(null)
    const fallo = await desactivarUsuario(requireSupabase(), u)
    if (fallo) {
      setError(fallo)
      return
    }
    setOk(u.esInvitacion ? 'Invitación cancelada' : 'Usuario desactivado')
    await cargarUsuarios()
  }

  async function onGuardarPermisos() {
    if (!editUser) return
    setError(null)
    setGuardandoPerm(true)
    const fallo = await guardarPermisosColaborador(requireSupabase(), editUser, accesoEdit)
    setGuardandoPerm(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setOk('Permisos actualizados')
    setEditUser(null)
    await cargarUsuarios()
  }

  async function onInvitarColaborador() {
    if (!perfil) return
    setError(null)
    setOk(null)
    if (!emailInv.trim()) {
      setError('Completá el email del colaborador')
      return
    }
    setEnviandoInv(true)
    const fallo = await invitarColaborador(requireSupabase(), {
      email: emailInv.trim(),
      acceso: accesoInv,
    })
    setEnviandoInv(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setOk(`Invitación enviada a ${emailInv.trim()}`)
    setLinkInv({
      url: linkInvitacionColaborador(perfil.empresa.id),
      texto: textoLinkInvitacion(perfil.empresa.id),
    })
    setInvitar(false)
    setEmailInv('')
    setAccesoInv(accesoSoloPedidos())
    setPresetInv('pedidos')
    await cargarUsuarios()
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
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <AppNav />
        <div className="p-6 backdrop-blur-xl" style={cardShell}>
          <h1 className="text-[28px] font-semibold" style={{ fontFamily: theme.fontDisplay, color: 'var(--text)' }}>
            Configuración
          </h1>
          <p className="mt-1 text-[13px]" style={{ fontFamily: theme.fontSubtitle, color: 'var(--text-muted)' }}>
            {perfil.empresa.nombre}
          </p>

          {tab ? (
            <button
              className="mt-5 text-sm font-semibold text-[#A5B4FC] hover:underline"
              type="button"
              onClick={() => {
                setTab(null)
                setSearchParams({}, { replace: true })
                setError(null)
                setOk(null)
              }}
            >
              ← Volver
            </button>
          ) : (
            <div className="config-mosaic mt-6">
              {mosaicoVisible.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className="config-mosaic-card"
                  onClick={() => {
                    setTab(card.id)
                    setSearchParams(card.id === 'medios' ? { tab: card.id } : { tab: card.id }, { replace: true })
                    setError(null)
                    setOk(null)
                  }}
                >
                  <span className="config-mosaic-icon" aria-hidden>
                    {card.icono}
                  </span>
                  <span className="config-mosaic-body">
                    <span className="config-mosaic-title">
                      {card.titulo}
                      {card.id === 'plan' ? (
                        <span className="config-plan-badge">{etiquetaPlan(perfil.empresa.plan_actual)}</span>
                      ) : null}
                    </span>
                    <span className="config-mosaic-sub">{card.subtitulo}</span>
                  </span>
                  <span className="config-mosaic-arrow" aria-hidden>
                    →
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab && cargando ? (
            <p className="mt-6 text-sm text-[#94A3B8]">Cargando…</p>
          ) : null}

          {tab && !cargando ? (
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

              {tab === 'categorias' ? (
                <div className="mt-6 space-y-4">
                  <p className="text-sm font-medium text-[#F1F5F9]">Categorías de productos</p>
                  <ul className="mt-3 space-y-2">
                    {categorias.map((c) => (
                      <li key={c.id} className="rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-[#F1F5F9]">{c.nombre}</p>
                            {c.descripcion ? (
                              <p className="mt-1 text-xs text-[#94A3B8]">{c.descripcion}</p>
                            ) : null}
                            <p className="mt-1 text-[11px] text-[#94A3B8]">
                              {c.activo ? 'Activa' : 'Inactiva'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="text-xs font-semibold text-[#A5B4FC]"
                              onClick={() => {
                                setEditCat(c)
                                setAltaCat(true)
                                setNombreCat(c.nombre)
                                setDescCat(c.descripcion)
                                setActivoCat(c.activo)
                                setOk(null)
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold text-[#DC2626]"
                              onClick={() => {
                                void (async () => {
                                  if (!window.confirm(`¿Eliminar “${c.nombre}”?`)) return
                                  const fallo = await eliminarCategoria(requireSupabase(), c.id)
                                  if (fallo) setError(fallo)
                                  else void recargarCategorias()
                                })()
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button
                    className="mt-3 h-10 w-full rounded-lg border border-[rgba(99,102,241,0.3)] text-sm font-semibold text-[#A5B4FC]"
                    type="button"
                    onClick={() => {
                      resetFormCategoria()
                      setAltaCat(true)
                    }}
                  >
                    Nueva categoría
                  </button>
                  {altaCat ? (
                    <div className="mt-3 space-y-3 rounded-xl border border-[rgba(99,102,241,0.15)] p-3">
                      <label className="block text-sm font-medium text-[#94A3B8]">
                        Nombre
                        <input
                          className={`${inputClass} mt-1`}
                          value={nombreCat}
                          onChange={(ev) => setNombreCat(ev.target.value)}
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#94A3B8]">
                        Descripción
                        <input
                          className={`${inputClass} mt-1`}
                          value={descCat}
                          onChange={(ev) => setDescCat(ev.target.value)}
                        />
                      </label>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-[#94A3B8]">Activo</p>
                        <Toggle on={activoCat} onChange={() => setActivoCat((v) => !v)} />
                      </div>
                      <div className="flex gap-2">
                        <button
                          className={`${btnPrimary} flex-1`}
                          type="button"
                          onClick={() => {
                            void (async () => {
                              const fallo = await guardarCategoria(requireSupabase(), {
                                id: editCat?.id,
                                empresaId: perfil.empresa.id,
                                nombre: nombreCat,
                                descripcion: descCat,
                                activo: activoCat,
                              })
                              if (fallo) setError(fallo)
                              else {
                                resetFormCategoria()
                                setOk('Categoría guardada')
                                void recargarCategorias()
                              }
                            })()
                          }}
                        >
                          Guardar
                        </button>
                        <button
                          className="h-10 flex-1 rounded-lg border border-[rgba(99,102,241,0.3)] text-sm font-semibold text-[#94A3B8]"
                          type="button"
                          onClick={() => resetFormCategoria()}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === 'ubicaciones' ? (
                <div className="mt-6 space-y-4">
                  <p className="text-sm font-medium text-[#F1F5F9]">Ubicaciones</p>
                  <p className="text-xs text-[#94A3B8]">
                    Depósitos, locales y stands de la empresa. Si una ubicación tiene movimientos, desactivala
                    en vez de eliminarla.
                  </p>
                  <label className="block text-sm font-medium text-[#94A3B8]">
                    Ubicación de venta por defecto
                    <select
                      className={`${inputClass} mt-1`}
                      value={ubicacionVentaDefault}
                      onChange={(ev) => {
                        setOk(null)
                        setUbicacionVentaDefault(ev.target.value)
                      }}
                    >
                      <option value="">Primera ubicación activa</option>
                      {ubicacionesCfg
                        .filter((u) => u.activo)
                        .map((u) => (
                          <option key={u.id} value={u.nombre}>
                            {u.nombre}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p className="text-xs text-[#94A3B8]">
                    Se preselecciona al cargar el formulario de nueva venta.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {ubicacionesCfg.map((u) => (
                      <li key={u.id} className="rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-[#F1F5F9]">{u.nombre}</p>
                            {u.descripcion ? (
                              <p className="mt-1 text-xs text-[#94A3B8]">{u.descripcion}</p>
                            ) : null}
                            <p className="mt-1 text-[11px] text-[#94A3B8]">
                              {etiquetaTipoUbicacion(u.tipo)} · {u.activo ? 'Activa' : 'Inactiva'}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Toggle
                              on={u.activo}
                              onChange={() => {
                                void (async () => {
                                  const fallo = await guardarUbicacion(requireSupabase(), {
                                    id: u.id,
                                    empresaId: perfil.empresa.id,
                                    nombre: u.nombre,
                                    descripcion: u.descripcion ?? '',
                                    tipo: u.tipo,
                                    activo: !u.activo,
                                  })
                                  if (fallo) setError(fallo)
                                  else void recargarUbicaciones()
                                })()
                              }}
                            />
                            <button
                              type="button"
                              className="text-xs font-semibold text-[#A5B4FC]"
                              onClick={() => {
                                setEditUbic(u)
                                setAltaUbic(true)
                                setNombreUbic(u.nombre)
                                setDescUbic(u.descripcion ?? '')
                                setTipoUbic(u.tipo)
                                setActivoUbic(u.activo)
                                setOk(null)
                                setError(null)
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold text-[#DC2626]"
                              onClick={() => {
                                void (async () => {
                                  if (!window.confirm(`¿Eliminar “${u.nombre}”?`)) return
                                  const fallo = await eliminarUbicacion(requireSupabase(), u)
                                  if (fallo) setError(fallo)
                                  else void recargarUbicaciones()
                                })()
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button
                    className="mt-3 h-10 w-full rounded-lg border border-[rgba(99,102,241,0.3)] text-sm font-semibold text-[#A5B4FC]"
                    type="button"
                    onClick={() => {
                      resetFormUbicacion()
                      setAltaUbic(true)
                    }}
                  >
                    Nueva ubicación
                  </button>
                  {altaUbic ? (
                    <div className="mt-3 space-y-3 rounded-xl border border-[rgba(99,102,241,0.15)] p-3">
                      <label className="block text-sm font-medium text-[#94A3B8]">
                        Nombre
                        <input
                          className={`${inputClass} mt-1`}
                          value={nombreUbic}
                          placeholder='Ej: "Depósito central", "Local 1"'
                          onChange={(ev) => setNombreUbic(ev.target.value)}
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#94A3B8]">
                        Descripción
                        <input
                          className={`${inputClass} mt-1`}
                          value={descUbic}
                          onChange={(ev) => setDescUbic(ev.target.value)}
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#94A3B8]">
                        Tipo
                        <select
                          className={`${inputClass} mt-1`}
                          value={tipoUbic}
                          onChange={(ev) => setTipoUbic(ev.target.value as TipoUbicacion)}
                        >
                          {TIPOS_UBICACION.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-[#94A3B8]">Activo</p>
                        <Toggle on={activoUbic} onChange={() => setActivoUbic((v) => !v)} />
                      </div>
                      <div className="flex gap-2">
                        <button
                          className={`${btnPrimary} flex-1`}
                          type="button"
                          onClick={() => {
                            void (async () => {
                              const fallo = await guardarUbicacion(requireSupabase(), {
                                id: editUbic?.id,
                                empresaId: perfil.empresa.id,
                                nombre: nombreUbic,
                                descripcion: descUbic,
                                tipo: tipoUbic,
                                activo: activoUbic,
                              })
                              if (fallo) setError(fallo)
                              else {
                                resetFormUbicacion()
                                setOk('Ubicación guardada')
                                void recargarUbicaciones()
                              }
                            })()
                          }}
                        >
                          Guardar
                        </button>
                        <button
                          className="h-10 flex-1 rounded-lg border border-[rgba(99,102,241,0.3)] text-sm font-semibold text-[#94A3B8]"
                          type="button"
                          onClick={() => resetFormUbicacion()}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[#F1F5F9]">Equipo — Usuarios y colaboradores</p>
                    <button
                      className="h-9 rounded-lg bg-[#6366F1] px-3 text-xs font-semibold text-white hover:bg-[#4F46E5]"
                      type="button"
                      onClick={() => {
                        setInvitar((v) => {
                          if (!v) {
                            setAccesoInv(accesoSoloPedidos())
                            setPresetInv('pedidos')
                          }
                          return !v
                        })
                        setError(null)
                        setOk(null)
                      }}
                    >
                      {invitar ? 'Cerrar' : 'Invitar colaborador'}
                    </button>
                  </div>

                  {invitar ? (
                    <div className="mt-3 space-y-3 rounded-xl border border-[rgba(99,102,241,0.15)] p-3">
                      <label className="block text-sm font-medium text-[#94A3B8]">
                        Email del colaborador
                        <input
                          className={`${inputClass} mt-1`}
                          type="email"
                          value={emailInv}
                          onChange={(ev) => setEmailInv(ev.target.value)}
                        />
                      </label>
                      <PermisosChecklist
                        acceso={accesoInv}
                        onChange={setAccesoInv}
                        preset={presetInv}
                        onPreset={setPresetInv}
                      />
                      <button
                        className="h-10 w-full rounded-lg bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                        type="button"
                        disabled={enviandoInv}
                        onClick={() => void onInvitarColaborador()}
                      >
                        {enviandoInv ? 'ENVIANDO…' : 'Invitar'}
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-[#94A3B8]">
                          <th className="py-2 pr-3">Nombre</th>
                          <th className="py-2 pr-3">Email</th>
                          <th className="py-2 pr-3">Estado</th>
                          <th className="py-2">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarios.map((u) => (
                          <tr key={u.id} className="border-t border-[rgba(99,102,241,0.15)]">
                            <td className="py-2.5 pr-3 font-medium text-[#F1F5F9]">{u.nombre}</td>
                            <td className="py-2.5 pr-3 text-[#CBD5E1]">{u.email}</td>
                            <td className="py-2.5 pr-3 text-[#CBD5E1]">
                              {u.invitacionPendiente || u.esInvitacion
                                ? 'Invitación pendiente'
                                : u.activo
                                  ? 'Activo'
                                  : 'Inactivo'}
                            </td>
                            <td className="py-2.5">
                              {u.rol === 'dueno' ? (
                                <span className="text-xs text-[#94A3B8]">Acceso total</span>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    className="text-xs font-semibold text-[#A5B4FC]"
                                    type="button"
                                    onClick={() => {
                                      setEditUser(u)
                                      setAccesoEdit(u.acceso)
                                      setPresetEdit(detectarPreset(u.acceso))
                                    }}
                                  >
                                    Editar permisos
                                  </button>
                                  {u.activo || u.esInvitacion ? (
                                    <button
                                      className="text-xs font-semibold text-[#DC2626]"
                                      type="button"
                                      onClick={() => void onDesactivar(u)}
                                    >
                                      Desactivar
                                    </button>
                                  ) : null}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-8 border-t border-[rgba(99,102,241,0.15)] pt-5">
                    <p className="text-sm font-medium text-[#F1F5F9]">Modo de asignación de pedidos</p>
                    <div className="mt-3 grid gap-2">
                      {(
                        [
                          {
                            id: 'manual' as const,
                            icono: '⚪',
                            titulo: 'Manual',
                            nota: 'El dueño asigna cada pedido',
                          },
                          {
                            id: 'round_robin' as const,
                            icono: '🔄',
                            titulo: 'Round Robin',
                            nota: 'Rota entre colaboradores activos',
                          },
                          {
                            id: 'todo_a_uno' as const,
                            icono: '👤',
                            titulo: 'Todo a uno',
                            nota: 'Siempre al mismo colaborador',
                          },
                        ] as const
                      ).map((op) => (
                        <label
                          key={op.id}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-3"
                        >
                          <input
                            className="mt-1"
                            type="radio"
                            name="modo-asignacion"
                            checked={modoAsignacion === op.id}
                            onChange={() => {
                              setOk(null)
                              setModoAsignacion(op.id)
                            }}
                          />
                          <span>
                            <span className="block text-sm font-medium text-[#F1F5F9]">
                              {op.icono} {op.titulo}
                            </span>
                            <span className="mt-0.5 block text-xs text-[#94A3B8]">{op.nota}</span>
                          </span>
                        </label>
                      ))}
                    </div>

                    {modoAsignacion === 'todo_a_uno' ? (
                      <label className="mt-4 block text-sm font-medium text-[#94A3B8]">
                        Asignar siempre a
                        <select
                          className={`${inputClass} mt-1`}
                          value={asignacionFija}
                          onChange={(ev) => {
                            setOk(null)
                            setAsignacionFija(ev.target.value)
                          }}
                        >
                          <option value="">Elegí colaborador</option>
                          {usuarios
                            .filter((u) => u.activo && !u.esInvitacion)
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nombre || u.email}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : null}

                    {modoAsignacion === 'round_robin' ? (
                      <ul className="mt-4 space-y-2">
                        {usuarios
                          .filter((u) => u.activo && !u.esInvitacion)
                          .map((u) => {
                            const on =
                              rotacionIds.length === 0 ? true : rotacionIds.includes(u.id)
                            return (
                              <li
                                key={u.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-2"
                              >
                                <span className="text-sm text-[#F1F5F9]">
                                  {u.nombre || u.email}
                                </span>
                                <Toggle
                                  on={on}
                                  onChange={() => {
                                    setOk(null)
                                    const activos = usuarios
                                      .filter((x) => x.activo && !x.esInvitacion)
                                      .map((x) => x.id)
                                    const actual = rotacionIds.length === 0 ? activos : rotacionIds
                                    const next = actual.includes(u.id)
                                      ? actual.filter((id) => id !== u.id)
                                      : [...actual, u.id]
                                    setRotacionIds(next)
                                  }}
                                />
                              </li>
                            )
                          })}
                      </ul>
                    ) : null}
                  </div>
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

              {tab === 'inventario' ? (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-[#F1F5F9]">
                    Alertar cuando el stock baje de X unidades
                    <input
                      className={`${inputClass} mt-2`}
                      inputMode="numeric"
                      value={umbralStock}
                      onChange={(ev) => {
                        setOk(null)
                        setUmbralStock(ev.target.value)
                      }}
                    />
                  </label>
                  <p className="mt-2 text-xs text-[#94A3B8]">
                    En el inicio vas a ver un aviso si un producto activo queda en 0 o por debajo de este número.
                  </p>
                </div>
              ) : null}

              {tab === 'variantes' ? (
                <div className="mt-6 space-y-4">
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#F1F5F9]">Usar variantes</p>
                      <p className="mt-0.5 text-xs text-[#94A3B8]">
                        Activá esto si tus productos tienen variantes como color, talle o material
                      </p>
                    </div>
                    <Toggle on={usaVariantes} onChange={() => void toggleUsaVariantes()} />
                  </div>
                  {usaVariantes ? (
                    <div>
                      <p className="text-sm font-medium text-[#F1F5F9]">Atributos globales</p>
                      <ul className="mt-3 space-y-2">
                        {atributos.map((a) => (
                          <li key={a.id} className="rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-[#F1F5F9]">{a.nombre}</p>
                                <p className="mt-1 text-xs text-[#94A3B8]">{a.valores.join(', ')}</p>
                                <p className="mt-1 text-[11px] text-[#94A3B8]">
                                  Activo en ventas: {a.activoVentas ? 'ON' : 'OFF'}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-[#94A3B8]">Activo en ventas</span>
                                  <Toggle
                                    on={a.activoVentas}
                                    onChange={() => {
                                      void guardarAtributo(requireSupabase(), {
                                        id: a.id,
                                        empresaId: perfil.empresa.id,
                                        nombre: a.nombre,
                                        valores: a.valores,
                                        activoVentas: !a.activoVentas,
                                      }).then((fallo) => {
                                        if (fallo) setError(fallo)
                                        else void recargarAtributos()
                                      })
                                    }}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-[#A5B4FC]"
                                    onClick={() => {
                                      setEditAtributo(a)
                                      setAltaAtributo(true)
                                      setNombreAtr(a.nombre)
                                      setValoresAtr(a.valores)
                                      setChipAtr('')
                                      setActivoVentasAtr(a.activoVentas)
                                      setOk(null)
                                    }}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-[#DC2626]"
                                    onClick={() => {
                                      void (async () => {
                                        const usado = await atributoTieneVariantesActivas(
                                          requireSupabase(),
                                          a.nombre,
                                        )
                                        if (usado) {
                                          const okEliminar = window.confirm(
                                            `“${a.nombre}” tiene variantes activas. Si lo eliminás, esas combinaciones pueden quedar desalineadas. ¿Eliminar igual?`,
                                          )
                                          if (!okEliminar) return
                                        }
                                        const fallo = await eliminarAtributo(requireSupabase(), a.id)
                                        if (fallo) setError(fallo)
                                        else void recargarAtributos()
                                      })()
                                    }}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <button
                        className="mt-3 h-10 w-full rounded-lg border border-[rgba(99,102,241,0.3)] text-sm font-semibold text-[#A5B4FC]"
                        type="button"
                        onClick={() => {
                          resetFormAtributo()
                          setAltaAtributo(true)
                        }}
                      >
                        Agregar atributo
                      </button>
                      {altaAtributo ? (
                        <div className="mt-3 space-y-3 rounded-xl border border-[rgba(99,102,241,0.15)] p-3">
                          <label className="block text-sm font-medium text-[#94A3B8]">
                            Nombre
                            <input
                              className={`${inputClass} mt-1`}
                              value={nombreAtr}
                              onChange={(ev) => setNombreAtr(ev.target.value)}
                            />
                          </label>
                          <div>
                            <p className="text-sm font-medium text-[#94A3B8]">Valores</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {valoresAtr.map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  className="rounded-full bg-[#6366F1] px-2.5 py-1 text-xs font-semibold text-white"
                                  onClick={() => setValoresAtr((prev) => prev.filter((x) => x !== v))}
                                >
                                  {v} ×
                                </button>
                              ))}
                            </div>
                            <input
                              className={`${inputClass} mt-2`}
                              value={chipAtr}
                              placeholder="Escribí un valor y Enter"
                              onChange={(ev) => setChipAtr(ev.target.value)}
                              onKeyDown={(ev) => {
                                if (ev.key !== 'Enter') return
                                ev.preventDefault()
                                const v = chipAtr.trim()
                                if (!v) return
                                setValoresAtr((prev) => (prev.includes(v) ? prev : [...prev, v]))
                                setChipAtr('')
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-[#94A3B8]">Activo en ventas</p>
                            <Toggle on={activoVentasAtr} onChange={() => setActivoVentasAtr((v) => !v)} />
                          </div>
                          <button
                            className="h-10 w-full rounded-lg bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5]"
                            type="button"
                            onClick={() => void onGuardarAtributo()}
                          >
                            Guardar atributo
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === 'lotes' ? (
                <div className="mt-6 space-y-4">
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#F1F5F9]">Usar lotes y vencimientos</p>
                      <p className="mt-0.5 text-xs text-[#94A3B8]">
                        Activá esto para controlar el stock por lote de compra y gestionar fechas de vencimiento.
                        Ideal para alimentos, cosméticos y farmacia.
                      </p>
                    </div>
                    <Toggle on={usaLotes} onChange={() => toggleUsaLotes()} />
                  </div>
                  {avisoLotes && usaLotes ? (
                    <p className="rounded-lg bg-indigo-500/10 px-3 py-3 text-sm text-[#A5B4FC]">
                      Tus productos existentes no tienen lote asignado. A partir de ahora cada compra puede tener un
                      lote.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {tab === 'remitente' ? (
                <div className="mt-6 space-y-3">
                  <p className="text-sm font-medium text-[#F1F5F9]">Datos del remitente</p>
                  <p className="text-xs text-[#94A3B8]">
                    Figuran en el remito PDF y en el texto de email al despachar.
                  </p>
                  <label className="block text-sm font-medium text-[#94A3B8]">
                    Nombre completo
                    <input
                      className={`${inputClass} mt-1`}
                      value={remitenteNombre}
                      placeholder='Ej: "Sergio Echevarrieta"'
                      onChange={(ev) => setRemitenteNombre(ev.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#94A3B8]">
                    Dirección
                    <input
                      className={`${inputClass} mt-1`}
                      value={remitenteDireccion}
                      placeholder='Ej: "Garibaldi y San Martín"'
                      onChange={(ev) => setRemitenteDireccion(ev.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#94A3B8]">
                    Teléfono
                    <input
                      className={`${inputClass} mt-1`}
                      value={remitenteTelefono}
                      onChange={(ev) => setRemitenteTelefono(ev.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#94A3B8]">
                    Email
                    <input
                      className={`${inputClass} mt-1`}
                      value={remitenteEmail}
                      onChange={(ev) => setRemitenteEmail(ev.target.value)}
                    />
                  </label>
                </div>
              ) : null}

              {tab === 'plan' && esDueno(perfil.usuario.rol) ? (
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

              {tab === 'medios' || tab === 'cuotas' || tab === 'flujo' || tab === 'inventario' || tab === 'variantes' || tab === 'lotes' || tab === 'ubicaciones' || tab === 'remitente' || tab === 'usuarios' ? (
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
          ) : null}

          <Link className="mt-6 block text-center text-sm font-medium text-[#A5B4FC]" to="/inicio">
            Volver al inicio
          </Link>
        </div>
      </div>
      <PlanesModal abierto={modalPlanes} onCerrar={() => setModalPlanes(false)} />
      {linkInv && perfil ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center">
          <div className="w-full max-w-md rounded-lg bg-white p-5 text-[#1A2F4A] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <h3 className="text-lg font-bold">Compartí este link con tu colaborador</h3>
            <p className="mt-3 break-all rounded-md bg-[#EEF2F6] px-3 py-2 text-sm">
              {linkInv.texto}
            </p>
            <p className="mt-2 text-xs text-[#4A5568]">{linkInv.url}</p>
            <div className="mt-4 flex gap-2">
              <button
                className={btnPrimary}
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(linkInv.url).then(
                    () => setOk('Link copiado'),
                    () => setError('No se pudo copiar'),
                  )
                }}
              >
                Copiar link
              </button>
              <button
                className="h-11 rounded-lg border border-[#E2E8F0] px-4 text-sm font-semibold text-[#4A5568]"
                type="button"
                onClick={() => setLinkInv(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {editUser ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
            style={{ background: '#1A2F4A' }}
          >
            <h3 className="text-lg font-bold text-[#F1F5F9]">Editar permisos</h3>
            <p className="mt-1 text-sm text-[#94A3B8]">{editUser.email}</p>
            <div className="mt-4">
              <PermisosChecklist
                acceso={accesoEdit}
                onChange={setAccesoEdit}
                preset={presetEdit}
                onPreset={setPresetEdit}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className={btnPrimary}
                type="button"
                disabled={guardandoPerm}
                onClick={() => void onGuardarPermisos()}
              >
                {guardandoPerm ? 'GUARDANDO…' : 'Guardar'}
              </button>
              <button
                className="h-11 rounded-lg border border-[rgba(99,102,241,0.35)] px-4 text-sm font-semibold text-[#A5B4FC]"
                type="button"
                onClick={() => setEditUser(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
