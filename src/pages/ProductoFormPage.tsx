import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { tienePermiso } from '../lib/permisos'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { AppNav } from '../components/AppNav'
import { actualizarProducto, crearProducto, listarProductos, type ProductoFila } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

const inputClass =
  'mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]'

export function ProductoFormPage() {
  const { id } = useParams()
  const esNuevo = !id || id === 'nuevo'
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [costo, setCosto] = useState('')
  const [stockInicial, setStockInicial] = useState('0')
  const [stockActual, setStockActual] = useState<number | null>(null)
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(!esNuevo)
  const [duplicado, setDuplicado] = useState<ProductoFila | null>(null)

  const titulo = useMemo(() => (esNuevo ? 'Nuevo producto' : 'Editar producto'), [esNuevo])

  useEffect(() => {
    if (esNuevo || !id) return
    void (async () => {
      const { filas, error: listError } = await listarProductos(requireSupabase())
      if (listError) {
        setError(listError)
        setCargando(false)
        return
      }
      const actual = filas.find((p) => p.id === id)
      if (!actual) {
        setError('No se encontró el producto')
        setCargando(false)
        return
      }
      setNombre(actual.nombre)
      setCategoria(actual.categoria ?? '')
      setPrecioVenta(String(actual.precio_venta))
      setCosto(String(actual.costo))
      setStockActual(actual.stock_actual)
      setActivo(actual.activo)
      setCargando(false)
    })()
  }, [esNuevo, id])

  async function guardar(forzarCrear: boolean) {
    setError(null)
    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    const precio = Number(precioVenta.replace(',', '.'))
    if (!Number.isFinite(precio) || precio < 0) {
      setError('El precio de venta es obligatorio')
      return
    }
    const costoNum = costo.trim() === '' ? null : Number(costo.replace(',', '.'))
    if (costoNum != null && (!Number.isFinite(costoNum) || costoNum < 0)) {
      setError('El costo no es válido')
      return
    }
    const stock = Number.parseInt(stockInicial, 10)
    if (esNuevo && (!Number.isFinite(stock) || stock < 0)) {
      setError('El stock inicial tiene que ser un número entero')
      return
    }

    const client = requireSupabase()

    if (esNuevo && !forzarCrear) {
      const { filas, error: listError } = await listarProductos(client)
      if (listError) {
        setError(listError)
        return
      }
      const nombreNorm = nombre.trim().toLowerCase()
      const existente = filas.find(
        (p) => p.activo && p.nombre.trim().toLowerCase() === nombreNorm,
      )
      if (existente) {
        setDuplicado(existente)
        return
      }
    }

    setEnviando(true)
    const fallo = esNuevo
      ? await crearProducto(client, {
          nombre: nombre.trim(),
          categoria: categoria.trim(),
          precioVenta: precio,
          costo: costoNum,
          stockInicial: Number.isFinite(stock) ? stock : 0,
          activo,
        })
      : await actualizarProducto(client, {
          id: id!,
          nombre: nombre.trim(),
          categoria: categoria.trim(),
          precioVenta: precio,
          costo: costoNum,
          activo,
        })
    setEnviando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    navigate('/productos', { replace: true })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setDuplicado(null)
    await guardar(false)
  }

  async function actualizarPrecioDuplicado() {
    if (!duplicado) return
    const precio = Number(precioVenta.replace(',', '.'))
    const costoNum = costo.trim() === '' ? null : Number(costo.replace(',', '.'))
    setEnviando(true)
    const fallo = await actualizarProducto(requireSupabase(), {
      id: duplicado.id,
      nombre: duplicado.nombre,
      categoria: duplicado.categoria ?? '',
      precioVenta: precio,
      costo: costoNum,
      activo: duplicado.activo,
    })
    setEnviando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    navigate('/productos', { replace: true })
  }

  async function onDesactivar() {
    if (esNuevo || !id) return
    const precio = Number(precioVenta.replace(',', '.'))
    const costoNum = costo.trim() === '' ? 0 : Number(costo.replace(',', '.'))
    setEnviando(true)
    const fallo = await actualizarProducto(requireSupabase(), {
      id,
      nombre: nombre.trim(),
      categoria: categoria.trim(),
      precioVenta: Number.isFinite(precio) ? precio : 0,
      costo: Number.isFinite(costoNum) ? costoNum : 0,
      activo: false,
    })
    setEnviando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setActivo(false)
  }

  if (!perfil) return null
  if (!tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'editar_productos')) {
    return <Navigate to="/productos" replace />
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
        <div className="rounded-lg bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <h1 className="text-xl font-bold text-[#1A2F4A]">{titulo}</h1>
          {cargando ? (
            <p className="mt-6 text-sm text-[#4A5568]">Cargando…</p>
          ) : (
            <form className="mt-6 flex flex-col" onSubmit={onSubmit}>
              <label className="text-sm font-medium text-[#4A5568]">
                Nombre
                <input className={inputClass} value={nombre} onChange={(ev) => {
                  setNombre(ev.target.value)
                  setDuplicado(null)
                }} />
              </label>
              <label className="mt-4 text-sm font-medium text-[#4A5568]">
                Categoría
                <input
                  className={inputClass}
                  value={categoria}
                  onChange={(ev) => setCategoria(ev.target.value)}
                />
              </label>
              <label className="mt-4 text-sm font-medium text-[#4A5568]">
                Precio de venta (ARS)
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={precioVenta}
                  onChange={(ev) => setPrecioVenta(ev.target.value)}
                />
              </label>
              <label className="mt-4 text-sm font-medium text-[#4A5568]">
                Costo (ARS)
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={costo}
                  onChange={(ev) => setCosto(ev.target.value)}
                />
              </label>
              {esNuevo ? (
                <label className="mt-4 text-sm font-medium text-[#4A5568]">
                  Stock inicial
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={stockInicial}
                    onChange={(ev) => setStockInicial(ev.target.value)}
                  />
                </label>
              ) : (
                <p className="mt-4 text-sm text-[#4A5568]">
                  Stock actual: <strong className="text-[#1A2F4A]">{stockActual ?? 0}</strong>
                  <span className="mt-1 block text-xs">El stock se modifica solo con movimientos de inventario.</span>
                </p>
              )}
              <label className="mt-4 flex items-center gap-3 text-sm font-medium text-[#4A5568]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#6366F1]"
                  checked={activo}
                  onChange={(ev) => setActivo(ev.target.checked)}
                />
                Activo
              </label>

              {duplicado ? (
                <div className="mt-4 rounded-md border border-[#6366F1] bg-[#EEF2FF] px-3 py-3 text-sm text-[#1A2F4A]">
                  <p>
                    Ya tenés un producto con ese nombre — ¿querés actualizar su precio en vez de
                    crear uno nuevo?
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      className="h-11 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                      type="button"
                      disabled={enviando}
                      onClick={() => void actualizarPrecioDuplicado()}
                    >
                      Actualizar precio
                    </button>
                    <button
                      className="h-11 w-full rounded-md border border-[#E2E8F0] text-sm font-semibold text-[#4A5568] disabled:opacity-50"
                      type="button"
                      disabled={enviando}
                      onClick={() => {
                        setDuplicado(null)
                        void guardar(true)
                      }}
                    >
                      Crear igual
                    </button>
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}

              <button
                className="mt-6 h-11 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                type="submit"
                disabled={enviando}
              >
                {enviando ? 'GUARDANDO…' : 'GUARDAR'}
              </button>
              {!esNuevo && activo ? (
                <button
                  className="mt-3 h-11 w-full rounded-md border border-[#E2E8F0] text-sm font-semibold text-[#DC2626]"
                  type="button"
                  disabled={enviando}
                  onClick={() => void onDesactivar()}
                >
                  Desactivar
                </button>
              ) : null}
              <Link className="mt-4 text-center text-sm font-medium text-[#6366F1]" to="/productos">
                Volver al listado
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
