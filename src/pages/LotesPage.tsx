import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  FilterCollapse,
  ListCard,
  MobileCards,
  PageTitle,
  PageSkeleton,
  TableCard,
  TableErrorRed,
  Th,
  Tr,
  btnPrimary,
  theadClass,
  theadStyle,
} from '../components/listado'
import { MSG_ERROR_RED, mensajeCargaTabla } from '../lib/consulta'
import { obtenerConfiguracion } from '../lib/configuracion'
import {
  crearLote,
  etiquetaEstadoLote,
  formatoFechaLote,
  listarLotes,
  sugerenciaNumeroLote,
  type EstadoLote,
  type LoteFila,
} from '../lib/lotes'
import { listarProductos, type ProductoFila } from '../lib/productos'
import { etiquetaProveedor, listarProveedoresEmpresa, type ProveedorFila } from '../lib/proveedores'
import { requireSupabase } from '../lib/supabase'
import { etiquetaCombo, listarVariantesDeProductos, type VarianteFila } from '../lib/variantes'
import { theme } from '../theme'

const inputClass =
  'h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]'

type FiltroEstado = 'todos' | 'vigente' | 'por_vencer' | 'vencido'

function parseEstadoParam(raw: string | null): FiltroEstado {
  if (raw === 'vigente' || raw === 'por_vencer' || raw === 'vencido') return raw
  return 'todos'
}

export function LotesPage() {
  const { perfil } = useAuth()
  const [params, setParams] = useSearchParams()
  const [habilitado, setHabilitado] = useState<boolean | null>(null)
  const [filas, setFilas] = useState<LoteFila[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstado>(parseEstadoParam(params.get('estado')))
  const [productoId, setProductoId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [productos, setProductos] = useState<ProductoFila[]>([])
  const [proveedores, setProveedores] = useState<ProveedorFila[]>([])
  const [modal, setModal] = useState(false)
  const [variantes, setVariantes] = useState<VarianteFila[]>([])

  const [nuevoProducto, setNuevoProducto] = useState('')
  const [nuevoVariante, setNuevoVariante] = useState('')
  const [nuevoNumero, setNuevoNumero] = useState('')
  const [nuevoElab, setNuevoElab] = useState('')
  const [nuevoVenc, setNuevoVenc] = useState('')
  const [nuevoCant, setNuevoCant] = useState('0')
  const [nuevoProv, setNuevoProv] = useState('')
  const [nuevoNotas, setNuevoNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState<string | null>(null)

  useEffect(() => {
    setEstadoFiltro(parseEstadoParam(params.get('estado')))
  }, [params])

  useEffect(() => {
    if (!perfil) return
    void obtenerConfiguracion(requireSupabase(), perfil.empresa.id).then(({ config }) => {
      setHabilitado(Boolean(config.usaLotes))
    })
  }, [perfil])

  const cargar = useCallback(async () => {
    setCargando(true)
    const client = requireSupabase()
    const [lotes, prods, provs] = await Promise.all([
      listarLotes(client, {
        productoId: productoId || undefined,
        proveedorId: proveedorId || undefined,
      }),
      listarProductos(client),
      listarProveedoresEmpresa(client),
    ])
    setCargando(false)
    if (lotes.error) {
      const msg = mensajeCargaTabla(lotes.error)
      setError(msg === MSG_ERROR_RED ? MSG_ERROR_RED : lotes.error)
      return
    }
    setError(null)
    setFilas(lotes.filas)
    if (!prods.error) setProductos(prods.filas)
    if (!provs.error) setProveedores(provs.filas)
  }, [productoId, proveedorId])

  useEffect(() => {
    if (habilitado) void cargar()
  }, [habilitado, cargar])

  const visibles = useMemo(() => {
    if (estadoFiltro === 'todos') return filas
    return filas.filter((f) => f.estado === estadoFiltro)
  }, [filas, estadoFiltro])

  const varsProducto = useMemo(
    () => variantes.filter((v) => v.productoId === nuevoProducto && v.activo),
    [variantes, nuevoProducto],
  )

  function cambiarEstado(next: FiltroEstado) {
    setEstadoFiltro(next)
    const nextParams = new URLSearchParams(params)
    if (next === 'todos') nextParams.delete('estado')
    else nextParams.set('estado', next)
    setParams(nextParams, { replace: true })
  }

  async function abrirModal() {
    setErrorModal(null)
    setNuevoProducto('')
    setNuevoVariante('')
    setNuevoNumero('')
    setNuevoElab('')
    setNuevoVenc('')
    setNuevoCant('0')
    setNuevoProv('')
    setNuevoNotas('')
    const vars = await listarVariantesDeProductos(
      requireSupabase(),
      productos.map((p) => p.id),
    )
    if (!vars.error) setVariantes(vars.filas)
    setModal(true)
  }

  function onCambioProducto(id: string) {
    setNuevoProducto(id)
    setNuevoVariante('')
    const prod = productos.find((p) => p.id === id)
    if (prod) setNuevoNumero(sugerenciaNumeroLote(prod.nombre))
  }

  async function guardarLote() {
    if (!perfil) return
    if (!nuevoProducto) {
      setErrorModal('Elegí un producto')
      return
    }
    if (!nuevoNumero.trim()) {
      setErrorModal('El número de lote es obligatorio')
      return
    }
    const cant = Number(nuevoCant.replace(',', '.'))
    if (!Number.isFinite(cant) || cant < 0) {
      setErrorModal('La cantidad inicial no es válida')
      return
    }
    setGuardando(true)
    setErrorModal(null)
    const res = await crearLote(requireSupabase(), {
      empresaId: perfil.empresa.id,
      productoId: nuevoProducto,
      varianteId: nuevoVariante || null,
      numeroLote: nuevoNumero,
      fechaElaboracion: nuevoElab || null,
      fechaVencimiento: nuevoVenc || null,
      cantidadInicial: cant,
      proveedorId: nuevoProv || null,
      notas: nuevoNotas,
      registrarMovimiento: cant > 0,
    })
    setGuardando(false)
    if (res.error || !res.id) {
      setErrorModal(res.error || 'No se pudo crear el lote')
      return
    }
    setModal(false)
    await cargar()
  }

  if (!perfil) return null
  if (habilitado === null) {
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
          <PageSkeleton />
        </div>
      </div>
    )
  }
  if (habilitado === false) return <Navigate to="/inicio" replace />

  const puedeEditar = perfil.usuario.rol !== 'visor'

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
        <PageTitle titulo="Lotes y vencimientos" subtitulo={`${visibles.length} ${visibles.length === 1 ? 'lote' : 'lotes'}`} />

        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <FilterCollapse activo={estadoFiltro !== 'todos' || Boolean(productoId) || Boolean(proveedorId)}>
            <div className="filter-field">
              <label htmlFor="lote-estado">Estado</label>
              <select
                id="lote-estado"
                value={estadoFiltro}
                onChange={(ev) => cambiarEstado(ev.target.value as FiltroEstado)}
              >
                <option value="todos">Todos</option>
                <option value="vigente">Vigentes</option>
                <option value="por_vencer">Por vencer</option>
                <option value="vencido">Vencidos</option>
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="lote-prod">Producto</label>
              <select id="lote-prod" value={productoId} onChange={(ev) => setProductoId(ev.target.value)}>
                <option value="">Todos</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="lote-prov">Proveedor</label>
              <select id="lote-prov" value={proveedorId} onChange={(ev) => setProveedorId(ev.target.value)}>
                <option value="">Todos</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {etiquetaProveedor(p)}
                  </option>
                ))}
              </select>
            </div>
          </FilterCollapse>
          {puedeEditar ? (
            <button className={btnPrimary} type="button" onClick={() => void abrirModal()}>
              Nuevo lote
            </button>
          ) : null}
        </div>

        {cargando && habilitado ? <PageSkeleton /> : null}
        {error === MSG_ERROR_RED ? <TableErrorRed onReintentar={() => void cargar()} /> : null}
        {!cargando && error && error !== MSG_ERROR_RED ? (
          <p className="mb-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}

        {!cargando && !error ? (
          <TableCard>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px] text-left">
                <thead className={theadClass} style={theadStyle}>
                  <tr>
                    <Th>N° Lote</Th>
                    <Th>Producto</Th>
                    <Th>Variante</Th>
                    <Th>Fecha elaboración</Th>
                    <Th>Fecha vencimiento</Th>
                    <Th>Stock actual</Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((fila, index) => {
                    const est = etiquetaEstadoLote(fila.estado)
                    return (
                      <Tr key={fila.id} index={index}>
                        <td className="px-3 py-3 font-medium">{fila.numeroLote}</td>
                        <td className="px-3 py-3">{fila.productoNombre}</td>
                        <td className="px-3 py-3">{fila.varianteEtiqueta ?? '—'}</td>
                        <td className="px-3 py-3">{formatoFechaLote(fila.fechaElaboracion)}</td>
                        <td className="px-3 py-3">{formatoFechaLote(fila.fechaVencimiento)}</td>
                        <td className="px-3 py-3 tabular-nums">{fila.stock}</td>
                        <td className="px-3 py-3">
                          {est.icono} {est.texto}
                        </td>
                      </Tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <MobileCards>
              {visibles.map((fila) => {
                const est = etiquetaEstadoLote(fila.estado as EstadoLote)
                return (
                  <ListCard key={fila.id}>
                    <p className="font-semibold">{fila.numeroLote}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {fila.productoNombre}
                      {fila.varianteEtiqueta ? ` · ${fila.varianteEtiqueta}` : ''}
                    </p>
                    <p className="mt-1 text-sm">
                      Vence {formatoFechaLote(fila.fechaVencimiento)} · Stock {fila.stock}
                    </p>
                    <p className="mt-1 text-sm">
                      {est.icono} {est.texto}
                    </p>
                  </ListCard>
                )
              })}
            </MobileCards>
            {visibles.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No hay lotes para mostrar.
              </p>
            ) : null}
          </TableCard>
        ) : null}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <button className="absolute inset-0 bg-black/50" type="button" aria-label="Cerrar" onClick={() => setModal(false)} />
          <div
            className="relative z-10 w-full max-w-lg rounded-t-2xl p-5 md:rounded-2xl"
            style={{ background: 'var(--card-bg)', color: 'var(--text)' }}
          >
            <h2 className="text-lg font-semibold">Nuevo lote</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                Producto
                <select className={`${inputClass} mt-1`} value={nuevoProducto} onChange={(ev) => onCambioProducto(ev.target.value)}>
                  <option value="">Elegí un producto</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              {varsProducto.length > 0 ? (
                <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                  Variante
                  <select className={`${inputClass} mt-1`} value={nuevoVariante} onChange={(ev) => setNuevoVariante(ev.target.value)}>
                    <option value="">Sin variante</option>
                    {varsProducto.map((v) => (
                      <option key={v.id} value={v.id}>
                        {etiquetaCombo(v.atributos)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                N° de lote
                <input className={`${inputClass} mt-1`} value={nuevoNumero} onChange={(ev) => setNuevoNumero(ev.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                  Elaboración
                  <input className={`${inputClass} mt-1`} type="date" value={nuevoElab} onChange={(ev) => setNuevoElab(ev.target.value)} />
                </label>
                <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                  Vencimiento
                  <input className={`${inputClass} mt-1`} type="date" value={nuevoVenc} onChange={(ev) => setNuevoVenc(ev.target.value)} />
                </label>
              </div>
              <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                Cantidad inicial
                <input className={`${inputClass} mt-1`} inputMode="decimal" value={nuevoCant} onChange={(ev) => setNuevoCant(ev.target.value)} />
              </label>
              <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                Proveedor
                <select className={`${inputClass} mt-1`} value={nuevoProv} onChange={(ev) => setNuevoProv(ev.target.value)}>
                  <option value="">Sin proveedor</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {etiquetaProveedor(p)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                Notas
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 py-2 text-sm text-[#1A2F4A]"
                  value={nuevoNotas}
                  onChange={(ev) => setNuevoNotas(ev.target.value)}
                />
              </label>
            </div>
            {errorModal ? <p className="mt-3 text-sm text-[#F87171]">{errorModal}</p> : null}
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-md border px-3 py-2 text-sm" type="button" onClick={() => setModal(false)}>
                Cancelar
              </button>
              <button
                className="flex-1 rounded-md bg-[#6366F1] px-3 py-2 text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                type="button"
                disabled={guardando}
                onClick={() => void guardarLote()}
              >
                {guardando ? 'GUARDANDO…' : 'Crear lote'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
