import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { VarianteChipsPicker } from '../components/VarianteChipsPicker'
import { Breadcrumb, btnPrimary } from '../components/listado'
import { guardarOrdenCompra, obtenerOrdenCompra } from '../lib/ordenesCompra'
import { obtenerConfiguracion } from '../lib/configuracion'
import { formatoARS, listarProductos, type ProductoFila } from '../lib/productos'
import { etiquetaProveedor, listarProveedoresEmpresa, type ProveedorFila } from '../lib/proveedores'
import { requireSupabase } from '../lib/supabase'
import {
  etiquetaCombo,
  listarAtributos,
  listarVariantesDeProductos,
  type AtributoFila,
  type VarianteFila,
} from '../lib/variantes'
import { theme } from '../theme'

type Linea = {
  uid: string
  productoId: string
  varianteId: string | null
  nombre: string
  varianteEtiqueta: string
  cantidad: number
  precioUnitario: number
}

const inputClass =
  'mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white'

export function OrdenCompraNuevaPage() {
  const { id } = useParams()
  const esEdicion = Boolean(id)
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [paso, setPaso] = useState<1 | 2>(1)
  const [catalogo, setCatalogo] = useState<ProductoFila[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [proveedorId, setProveedorId] = useState('')
  const [proveedores, setProveedores] = useState<ProveedorFila[]>([])
  const [entrega, setEntrega] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [usaVariantes, setUsaVariantes] = useState(false)
  const [variantesCatalogo, setVariantesCatalogo] = useState<VarianteFila[]>([])
  const [atributos, setAtributos] = useState<AtributoFila[]>([])
  const [picker, setPicker] = useState<ProductoFila | null>(null)

  useEffect(() => {
    void listarProductos(requireSupabase()).then((res) => setCatalogo(res.filas))
    void listarProveedoresEmpresa(requireSupabase()).then((res) => {
      if (!res.error) setProveedores(res.filas)
    })
  }, [])

  useEffect(() => {
    if (!perfil) return
    void obtenerConfiguracion(requireSupabase(), perfil.empresa.id).then(async ({ config }) => {
      setUsaVariantes(Boolean(config.usaVariantes))
      if (config.usaVariantes) {
        const atr = await listarAtributos(requireSupabase())
        if (!atr.error) setAtributos(atr.filas)
      }
    })
  }, [perfil])

  useEffect(() => {
    if (!usaVariantes || catalogo.length === 0) return
    void listarVariantesDeProductos(
      requireSupabase(),
      catalogo.map((p) => p.id),
    ).then((vars) => {
      if (!vars.error) setVariantesCatalogo(vars.filas)
    })
  }, [usaVariantes, catalogo])

  useEffect(() => {
    if (!id) return
    void obtenerOrdenCompra(requireSupabase(), id).then(({ ficha, error: fallo }) => {
      if (fallo || !ficha) {
        setError(fallo || 'No se encontró la OC')
        return
      }
      if (ficha.estado !== 'borrador') {
        navigate(`/compras/oc/${id}`, { replace: true })
        return
      }
      setProveedorId(ficha.proveedorId ?? '')
      setEntrega(ficha.fechaEntregaEstimada ?? '')
      setNotas(ficha.notas ?? '')
      setLineas(
        ficha.items.map((it) => ({
          uid: it.id,
          productoId: it.productoId,
          varianteId: it.varianteId,
          nombre: it.nombre,
          varianteEtiqueta: it.varianteEtiqueta ?? '',
          cantidad: it.cantidadPedida,
          precioUnitario: it.precioUnitario,
        })),
      )
    })
  }, [id, navigate])

  const sugeridos = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return catalogo.slice(0, 8)
    return catalogo.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 8)
  }, [busqueda, catalogo])

  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0)

  function requiereVariante(producto: ProductoFila) {
    return usaVariantes && variantesCatalogo.some((v) => v.productoId === producto.id && v.activo)
  }

  function agregarLinea(producto: ProductoFila, varianteId: string | null, etiqueta: string) {
    const costo =
      varianteId != null
        ? (variantesCatalogo.find((v) => v.id === varianteId)?.costo ?? producto.costo)
        : producto.costo
    setLineas((prev) => [
      ...prev,
      {
        uid: crypto.randomUUID(),
        productoId: producto.id,
        varianteId,
        nombre: producto.nombre,
        varianteEtiqueta: etiqueta,
        cantidad: 1,
        precioUnitario: Number(costo) || 0,
      },
    ])
    setBusqueda('')
    setPicker(null)
  }

  function agregarProducto(producto: ProductoFila) {
    if (requiereVariante(producto)) {
      setPicker(producto)
      return
    }
    agregarLinea(producto, null, '')
  }

  async function persistir(estado: 'borrador' | 'enviada') {
    if (!perfil) return
    if (!proveedorId) {
      setError('Elegí un proveedor')
      return
    }
    if (lineas.length === 0) {
      setError('Agregá al menos un producto')
      return
    }
    setEnviando(true)
    setError(null)
    const { id: saved, error: fallo } = await guardarOrdenCompra(requireSupabase(), {
      id: esEdicion ? id : undefined,
      empresaId: perfil.empresa.id,
      proveedorId,
      fechaEntregaEstimada: entrega || null,
      notas,
      estado,
      items: lineas.map((l) => ({
        productoId: l.productoId,
        varianteId: l.varianteId,
        cantidadPedida: l.cantidad,
        precioUnitario: l.precioUnitario,
      })),
    })
    setEnviando(false)
    if (fallo || !saved) {
      setError(fallo || 'No se pudo guardar la OC')
      return
    }
    navigate(`/compras/oc/${saved}`, { replace: true })
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
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <AppNav />
        <Breadcrumb
          items={[
            { label: 'Compras', to: '/compras' },
            { label: 'Órdenes de compra', to: '/compras?tab=oc' },
            { label: esEdicion ? 'Editar OC' : 'Nueva OC' },
          ]}
        />
        <h1 className="mb-6 text-[28px] font-semibold" style={{ color: 'var(--text)', fontFamily: theme.fontDisplay }}>
          {esEdicion ? 'Editar orden de compra' : 'Nueva orden de compra'}
        </h1>
        {error ? <p className="mb-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}

        {paso === 1 ? (
          <div className="rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Proveedor
              <select className={inputClass} value={proveedorId} onChange={(ev) => setProveedorId(ev.target.value)}>
                <option value="">Elegí un proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {etiquetaProveedor(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Fecha de entrega estimada
              <input className={inputClass} type="date" value={entrega} onChange={(ev) => setEntrega(ev.target.value)} />
            </label>
            <label className="mt-4 block text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Buscar producto
              <input
                className={inputClass}
                value={busqueda}
                placeholder="Nombre del producto"
                onChange={(ev) => setBusqueda(ev.target.value)}
              />
            </label>
            <ul className="mt-2 max-h-48 overflow-auto rounded-md border" style={{ borderColor: 'var(--border)' }}>
              {sugeridos.map((p) => (
                <li key={p.id}>
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[rgba(99,102,241,0.12)]"
                    style={{ color: 'var(--text)' }}
                    type="button"
                    onClick={() => agregarProducto(p)}
                  >
                    {p.nombre}
                  </button>
                </li>
              ))}
            </ul>
            {picker ? (
              <div className="mt-3">
                <VarianteChipsPicker
                  producto={picker}
                  variantes={variantesCatalogo.filter((v) => v.productoId === picker.id && v.activo)}
                  stockPorId={new Map()}
                  clavesVisibles={atributos.map((a) => a.nombre)}
                  atributosCatalogo={atributos}
                  exigirStock={false}
                  etiquetaAccion="Agregar a la OC"
                  onElegir={(variante) => {
                    if (!variante) return
                    agregarLinea(picker, variante.id, etiquetaCombo(variante.atributos))
                  }}
                  onCancelar={() => setPicker(null)}
                />
              </div>
            ) : null}
            <div className="mt-4 space-y-3">
              {lineas.map((linea) => (
                <div key={linea.uid} className="rounded-md border p-3" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {linea.nombre}
                    {linea.varianteEtiqueta ? ` · ${linea.varianteEtiqueta}` : ''}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Cantidad
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={linea.cantidad}
                        onChange={(ev) => {
                          const n = Number(ev.target.value)
                          setLineas((prev) =>
                            prev.map((l) => (l.uid === linea.uid ? { ...l, cantidad: Number.isFinite(n) ? n : 0 } : l)),
                          )
                        }}
                      />
                    </label>
                    <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Precio unitario
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={linea.precioUnitario}
                        onChange={(ev) => {
                          const n = Number(ev.target.value.replace(',', '.'))
                          setLineas((prev) =>
                            prev.map((l) =>
                              l.uid === linea.uid ? { ...l, precioUnitario: Number.isFinite(n) ? n : 0 } : l,
                            ),
                          )
                        }}
                      />
                    </label>
                    <p className="self-end text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {formatoARS(linea.cantidad * linea.precioUnitario)}
                    </p>
                  </div>
                  <button
                    className="mt-2 text-xs text-[#F87171]"
                    type="button"
                    onClick={() => setLineas((prev) => prev.filter((l) => l.uid !== linea.uid))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-4 text-right text-lg font-bold" style={{ color: 'var(--text)' }}>
              Total {formatoARS(total)}
            </p>
            <button
              className={`${btnPrimary} mt-4 w-full`}
              type="button"
              onClick={() => {
                setError(null)
                if (!proveedorId) {
                  setError('Elegí un proveedor')
                  return
                }
                if (lineas.length === 0) {
                  setError('Agregá al menos un producto')
                  return
                }
                setPaso(2)
              }}
            >
              Continuar
            </button>
          </div>
        ) : (
          <div className="rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Proveedor:{' '}
              <strong style={{ color: 'var(--text)' }}>
                {etiquetaProveedor(proveedores.find((p) => p.id === proveedorId) ?? { nombre: '—' })}
              </strong>
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Entrega estimada: {entrega || '—'}
            </p>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: 'var(--text)' }}>
              {lineas.map((l) => (
                <li key={l.uid}>
                  {l.nombre}
                  {l.varianteEtiqueta ? ` (${l.varianteEtiqueta})` : ''} × {l.cantidad} —{' '}
                  {formatoARS(l.cantidad * l.precioUnitario)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-right font-bold" style={{ color: 'var(--text)' }}>
              Total {formatoARS(total)}
            </p>
            <label className="mt-4 block text-sm" style={{ color: 'var(--text-muted)' }}>
              Notas
              <textarea
                className="mt-1.5 min-h-[88px] w-full rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: '#E2E8F0', background: '#EEF2F6', color: '#1A2F4A' }}
                value={notas}
                onChange={(ev) => setNotas(ev.target.value)}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="h-11 rounded-lg px-4 text-sm text-[#A5B4FC]" type="button" onClick={() => setPaso(1)}>
                Volver
              </button>
              <button
                className="h-11 rounded-lg border border-[rgba(99,102,241,0.45)] px-4 text-sm font-semibold text-[#A5B4FC]"
                type="button"
                disabled={enviando}
                onClick={() => void persistir('borrador')}
              >
                Guardar como borrador
              </button>
              <button className={btnPrimary} type="button" disabled={enviando} onClick={() => void persistir('enviada')}>
                Enviar al proveedor
              </button>
            </div>
          </div>
        )}
        <Link className="mt-6 block text-center text-sm text-[#A5B4FC]" to="/compras?tab=oc">
          Volver a órdenes
        </Link>
      </div>
    </div>
  )
}
