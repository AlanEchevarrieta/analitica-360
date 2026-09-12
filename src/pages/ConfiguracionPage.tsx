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
  { id: 'usuarios', icono: '👥', titulo: 'Usuarios', subtitulo: 'Gestioná el acceso de tu equipo' },
  { id: 'flujo', icono: '💸', titulo: 'Flujo de ventas', subtitulo: 'Configurá el proceso de venta' },
  { id: 'inventario', icono: '📦', titulo: 'Inventario', subtitulo: 'Umbral de stock bajo y alertas' },
  { id: 'ubicaciones', icono: '📍', titulo: 'Ubicaciones', subtitulo: 'Depósitos, locales y stands' },
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
  const [nombreInv, setNombreInv] = useState('')
  const [emailInv, setEmailInv] = useState('')
  const [passwordInv, setPasswordInv] = useState('')
  const [rolInv, setRolInv] = useState<'operador' | 'visor'>('operador')
  const [permisosInv, setPermisosInv] = useState<Permisos>(permisosPorRol('operador'))
  const [enviandoInv, setEnviandoInv] = useState(false)
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
    if (!perfil || perfil.usuario.rol !== 'dueno') return
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
  if (perfil.usuario.rol !== 'dueno') return <Navigate to="/inicio" replace />

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
      umbralStockBajo: Number.parseInt(umbralStock, 10),
      usaVariantes,
      usaLotes,
      ubicacionVentaDefault,
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
              {MOSAICO.map((card) => (
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

              {tab === 'medios' || tab === 'cuotas' || tab === 'flujo' || tab === 'inventario' || tab === 'variantes' || tab === 'lotes' || tab === 'ubicaciones' ? (
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
    </div>
  )
}
