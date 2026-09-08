import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  confirmarCompra,
  crearProductoParaCompra,
  hoyCompraISO,
} from '../lib/compras'
import { formatoARS, listarProductos, type ProductoFila } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

type Linea = {
  productoId: string
  nombre: string
  cantidad: number
  costoUnitario: number
}

const inputClass =
  'h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]'

export function CompraNuevaPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [catalogo, setCatalogo] = useState<ProductoFila[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [proveedor, setProveedor] = useState('')
  const [fecha, setFecha] = useState(hoyCompraISO)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [creandoProducto, setCreandoProducto] = useState(false)
  const [lineaResaltada, setLineaResaltada] = useState<string | null>(null)
  const resaltadoTimer = useRef<number | null>(null)

  async function recargarCatalogo() {
    const { filas } = await listarProductos(requireSupabase())
    setCatalogo(filas)
    return filas
  }

  useEffect(() => {
    void recargarCatalogo()
  }, [])

  useEffect(() => {
    return () => {
      if (resaltadoTimer.current != null) window.clearTimeout(resaltadoTimer.current)
    }
  }, [])

  const sugeridos = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return catalogo.slice(0, 8)
    return catalogo.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 8)
  }, [busqueda, catalogo])

  const hayCoincidencia = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return catalogo.length > 0
    return catalogo.some((p) => p.nombre.toLowerCase().includes(q))
  }, [busqueda, catalogo])

  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.costoUnitario, 0)

  function resaltarLinea(productoId: string) {
    setLineaResaltada(productoId)
    if (resaltadoTimer.current != null) window.clearTimeout(resaltadoTimer.current)
    resaltadoTimer.current = window.setTimeout(() => setLineaResaltada(null), 1600)
  }

  function agregarProducto(producto: ProductoFila) {
    const yaEstaba = lineas.some((l) => l.productoId === producto.id)
    setLineas((prev) => {
      const existente = prev.find((l) => l.productoId === producto.id)
      if (existente) {
        return prev.map((l) =>
          l.productoId === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        )
      }
      return [
        {
          productoId: producto.id,
          nombre: producto.nombre,
          cantidad: 1,
          costoUnitario: producto.costo,
        },
        ...prev,
      ]
    })
    if (yaEstaba) resaltarLinea(producto.id)
    setBusqueda('')
    setMostrarNuevo(false)
    setError(null)
  }

  async function crearProductoInline() {
    const nombre = nuevoNombre.trim()
    const precio = Number(nuevoPrecio.replace(',', '.'))
    if (!nombre) {
      setError('Ingresá el nombre del producto')
      return
    }
    if (!Number.isFinite(precio) || precio < 0) {
      setError('Ingresá un precio de venta válido')
      return
    }
    setError(null)
    setCreandoProducto(true)
    const { id, error: fallo } = await crearProductoParaCompra(requireSupabase(), {
      nombre,
      precioVenta: precio,
    })
    setCreandoProducto(false)
    if (fallo || !id) {
      setError('No se pudo crear el producto')
      return
    }
    const filas = await recargarCatalogo()
    const creado = filas.find((p) => p.id === id) ?? {
      id,
      nombre,
      categoria: null,
      activo: true,
      precio_venta: precio,
      costo: 0,
      stock_actual: 0,
    }
    agregarProducto(creado)
    setNuevoNombre('')
    setNuevoPrecio('')
    setMostrarNuevo(false)
  }

  function irPaso2() {
    if (lineas.length === 0) {
      setError('Agregá al menos un producto')
      return
    }
    if (lineas.some((l) => l.cantidad < 1 || l.costoUnitario < 0)) {
      setError('Revisá cantidad y costo de cada línea')
      return
    }
    setError(null)
    setPaso(2)
  }

  async function confirmar() {
    setError(null)
    setEnviando(true)
    const fallo = await confirmarCompra(requireSupabase(), {
      items: lineas.map((l) => ({
        producto_id: l.productoId,
        producto_nombre: l.nombre,
        cantidad: l.cantidad,
        costo_unitario: l.costoUnitario,
      })),
      proveedor,
      fecha,
      notas,
    })
    setEnviando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setExito(true)
    window.setTimeout(() => navigate('/compras', { replace: true }), 1200)
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
      <div className="relative z-10 mx-auto max-w-[440px] px-4 py-8">
        <AppNav />
        <div className="rounded-lg bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <h1 className="text-xl font-bold text-[#1A2F4A]">Nueva compra</h1>
          <p className="mt-1 text-xs font-medium text-[#4A5568]">Paso {paso} de 3</p>

          {exito ? (
            <p className="mt-6 rounded-md bg-green-50 px-3 py-3 text-sm text-green-800">
              Compra registrada. Volviendo al listado…
            </p>
          ) : (
            <>
              {paso === 1 ? (
                <div className="mt-5">
                  <label className="text-sm font-medium text-[#4A5568]">
                    Buscar producto
                    <input
                      className={`${inputClass} mt-1.5`}
                      value={busqueda}
                      placeholder="Nombre del producto"
                      onChange={(ev) => {
                        setBusqueda(ev.target.value)
                        setMostrarNuevo(false)
                      }}
                    />
                  </label>
                  {sugeridos.length > 0 ? (
                    <ul className="mt-2 max-h-40 overflow-auto rounded-md border border-[#E2E8F0]">
                      {sugeridos.map((p) => (
                        <li key={p.id}>
                          <button
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[#1A2F4A] hover:bg-[#EEF2F6]"
                            type="button"
                            onClick={() => agregarProducto(p)}
                          >
                            <span>
                              {p.nombre}
                              {!p.activo ? (
                                <span className="ml-2 text-xs text-[#4A5568]">(inactivo)</span>
                              ) : null}
                            </span>
                            <span className="text-[#4A5568]">{formatoARS(p.costo)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-[#4A5568]">
                      {catalogo.length === 0
                        ? 'No hay productos en el catálogo.'
                        : 'Ningún producto coincide con la búsqueda.'}
                    </p>
                  )}

                  {!hayCoincidencia ? (
                    <button
                      className="mt-3 text-sm font-semibold text-[#6366F1]"
                      type="button"
                      onClick={() => {
                        setMostrarNuevo(true)
                        if (!nuevoNombre && busqueda.trim()) setNuevoNombre(busqueda.trim())
                      }}
                    >
                      Agregar producto nuevo
                    </button>
                  ) : null}

                  {mostrarNuevo ? (
                    <div className="mt-3 rounded-md border border-[#E2E8F0] p-3">
                      <label className="text-xs text-[#4A5568]">
                        Nombre
                        <input
                          className={`${inputClass} mt-1 h-9`}
                          value={nuevoNombre}
                          onChange={(ev) => setNuevoNombre(ev.target.value)}
                        />
                      </label>
                      <label className="mt-2 block text-xs text-[#4A5568]">
                        Precio de venta
                        <input
                          className={`${inputClass} mt-1 h-9`}
                          inputMode="decimal"
                          value={nuevoPrecio}
                          onChange={(ev) => setNuevoPrecio(ev.target.value)}
                        />
                      </label>
                      <button
                        className="mt-3 h-10 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                        type="button"
                        disabled={creandoProducto}
                        onClick={() => void crearProductoInline()}
                      >
                        {creandoProducto ? 'CREANDO…' : 'Guardar producto'}
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {lineas.map((linea) => (
                      <div
                        key={linea.productoId}
                        className={`rounded-md border p-3 transition-colors duration-300 ${
                          lineaResaltada === linea.productoId
                            ? 'border-[#6366F1] bg-[#EEF2FF]'
                            : 'border-[#E2E8F0] bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-[#1A2F4A]">{linea.nombre}</p>
                          <button
                            className="text-xs text-[#DC2626]"
                            type="button"
                            onClick={() =>
                              setLineas((prev) => prev.filter((l) => l.productoId !== linea.productoId))
                            }
                          >
                            Quitar
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <label className="text-xs text-[#4A5568]">
                            Cantidad
                            <input
                              className={`${inputClass} mt-1 h-9`}
                              inputMode="numeric"
                              value={linea.cantidad}
                              onChange={(ev) => {
                                const n = Number.parseInt(ev.target.value, 10)
                                setLineas((prev) =>
                                  prev.map((l) =>
                                    l.productoId === linea.productoId
                                      ? { ...l, cantidad: Number.isFinite(n) ? n : 0 }
                                      : l,
                                  ),
                                )
                              }}
                            />
                          </label>
                          <label className="text-xs text-[#4A5568]">
                            Costo unitario
                            <input
                              className={`${inputClass} mt-1 h-9`}
                              inputMode="decimal"
                              value={linea.costoUnitario}
                              onChange={(ev) => {
                                const n = Number(ev.target.value.replace(',', '.'))
                                setLineas((prev) =>
                                  prev.map((l) =>
                                    l.productoId === linea.productoId
                                      ? { ...l, costoUnitario: Number.isFinite(n) ? n : 0 }
                                      : l,
                                  ),
                                )
                              }}
                            />
                          </label>
                        </div>
                        <p className="mt-2 text-right text-sm text-[#1A2F4A]">
                          Subtotal {formatoARS(linea.cantidad * linea.costoUnitario)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-right text-sm font-semibold text-[#1A2F4A]">
                    Total {formatoARS(total)}
                  </p>
                </div>
              ) : null}

              {paso === 2 ? (
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-medium text-[#4A5568]">
                    Proveedor (opcional)
                    <input
                      className={`${inputClass} mt-1.5`}
                      value={proveedor}
                      onChange={(ev) => setProveedor(ev.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#4A5568]">
                    Fecha de la compra
                    <input
                      className={`${inputClass} mt-1.5`}
                      type="date"
                      value={fecha}
                      onChange={(ev) => setFecha(ev.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#4A5568]">
                    Notas (opcional)
                    <textarea
                      className="mt-1.5 min-h-[88px] w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 py-2 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]"
                      value={notas}
                      onChange={(ev) => setNotas(ev.target.value)}
                    />
                  </label>
                  <div className="rounded-md bg-[#EEF2F6] px-3 py-3 text-sm text-[#1A2F4A]">
                    {lineas.map((l) => (
                      <p key={l.productoId}>
                        {l.nombre} × {l.cantidad} — {formatoARS(l.cantidad * l.costoUnitario)}
                      </p>
                    ))}
                    <p className="mt-2 font-semibold">Total {formatoARS(total)}</p>
                  </div>
                </div>
              ) : null}

              {paso === 3 ? (
                <div className="mt-5 text-sm text-[#1A2F4A]">
                  <p>Vas a registrar esta compra:</p>
                  <div className="mt-3 rounded-md bg-[#EEF2F6] px-3 py-3">
                    {lineas.map((l) => (
                      <p key={l.productoId}>
                        {l.nombre} × {l.cantidad} — {formatoARS(l.cantidad * l.costoUnitario)}
                      </p>
                    ))}
                    {proveedor.trim() ? <p className="mt-2">Proveedor: {proveedor.trim()}</p> : null}
                    <p>Fecha: {fecha}</p>
                    {notas.trim() ? <p>Notas: {notas.trim()}</p> : null}
                    <p className="mt-2 font-semibold">Total {formatoARS(total)}</p>
                  </div>
                  <button
                    className="mt-6 h-11 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                    type="button"
                    disabled={enviando}
                    onClick={() => void confirmar()}
                  >
                    {enviando ? 'GUARDANDO…' : 'CONFIRMAR COMPRA'}
                  </button>
                </div>
              ) : null}

              {error ? (
                <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}

              <div className="mt-5 flex gap-2">
                {paso > 1 ? (
                  <button
                    className="h-11 flex-1 rounded-md border border-[#E2E8F0] text-sm font-semibold text-[#4A5568]"
                    type="button"
                    onClick={() => {
                      setError(null)
                      setPaso((p) => (p === 3 ? 2 : 1))
                    }}
                  >
                    Atrás
                  </button>
                ) : null}
                {paso === 1 ? (
                  <button
                    className="h-11 flex-1 rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5]"
                    type="button"
                    onClick={irPaso2}
                  >
                    Siguiente
                  </button>
                ) : null}
                {paso === 2 ? (
                  <button
                    className="h-11 flex-1 rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5]"
                    type="button"
                    onClick={() => {
                      if (!fecha) {
                        setError('Elegí la fecha de la compra')
                        return
                      }
                      setError(null)
                      setPaso(3)
                    }}
                  >
                    Siguiente
                  </button>
                ) : null}
              </div>
            </>
          )}

          <Link className="mt-4 block text-center text-sm font-medium text-[#6366F1]" to="/compras">
            Volver al listado
          </Link>
        </div>
      </div>
    </div>
  )
}
