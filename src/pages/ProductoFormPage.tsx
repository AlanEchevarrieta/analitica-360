import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { tienePermiso } from '../lib/permisos'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { AppNav } from '../components/AppNav'
import { Breadcrumb, PageSkeleton } from '../components/listado'
import { actualizarProducto, asignarCategoriaProducto, crearProducto, guardarCodigoBarra, guardarDimensionesProducto, leerDimensionesProducto, listarProductos, type ProductoFila } from '../lib/productos'
import { listarCategorias, type CategoriaFila } from '../lib/categorias'
import { ProductoVariantesEditor, type ProductoVariantesHandle } from '../components/ProductoVariantesEditor'
import { EscanerCodigoBarras } from '../components/EscanerCodigoBarras'
import { obtenerConfiguracion } from '../lib/configuracion'
import { estiloTipoMovimiento } from '../lib/inventario'
import { listarMovimientosProducto, type MovimientoFila } from '../lib/stock'
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
  const [categoriaId, setCategoriaId] = useState('')
  const [categorias, setCategorias] = useState<CategoriaFila[]>([])
  const [precioVenta, setPrecioVenta] = useState('')
  const [costo, setCosto] = useState('')
  const [stockInicial, setStockInicial] = useState('0')
  const [stockActual, setStockActual] = useState<number | null>(null)
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(!esNuevo)
  const [duplicado, setDuplicado] = useState<ProductoFila | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoFila[]>([])
  const [usaVariantes, setUsaVariantes] = useState(false)
  const [dimOpen, setDimOpen] = useState(false)
  const [altoCm, setAltoCm] = useState('')
  const [largoCm, setLargoCm] = useState('')
  const [anchoCm, setAnchoCm] = useState('')
  const [pesoGr, setPesoGr] = useState('')
  const [codigoBarra, setCodigoBarra] = useState('')
  const [escaner, setEscaner] = useState(false)
  const [costoDesdeVariantes, setCostoDesdeVariantes] = useState<number | null>(null)
  const variantesRef = useRef<ProductoVariantesHandle>(null)
  const onCostoCalculado = useCallback((valor: number | null) => {
    setCostoDesdeVariantes(valor)
  }, [])

  const titulo = useMemo(() => (esNuevo ? 'Nuevo producto' : 'Editar producto'), [esNuevo])

  useEffect(() => {
    if (categoriaId || !categoria) return
    const hit = categorias.find((c) => c.nombre.trim().toLowerCase() === categoria.trim().toLowerCase())
    if (hit) setCategoriaId(hit.id)
  }, [categorias, categoria, categoriaId])

  function numOpcional(s: string): number | null {
    const t = s.trim()
    if (!t) return null
    const n = Number(t.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  async function persistirDimensiones(productoId: string) {
    return guardarDimensionesProducto(requireSupabase(), {
      id: productoId,
      altoCm: numOpcional(altoCm),
      largoCm: numOpcional(largoCm),
      anchoCm: numOpcional(anchoCm),
      pesoGr: numOpcional(pesoGr),
    })
  }

  useEffect(() => {
    if (!perfil) return
    void obtenerConfiguracion(requireSupabase(), perfil.empresa.id).then(({ config }) => {
      setUsaVariantes(Boolean(config.usaVariantes))
    })
    void listarCategorias(requireSupabase(), true).then((res) => {
      if (!res.error) setCategorias(res.filas)
    })
  }, [perfil])

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
      setCategoriaId(actual.categoria_id ?? '')
      setPrecioVenta(String(actual.precio_venta))
      setCosto(String(actual.costo))
      setStockActual(actual.stock_actual)
      setActivo(actual.activo)
      setCodigoBarra(actual.codigo_barra ?? '')
      const extraCat = await requireSupabase().from('productos').select('categoria_id, codigo_barra').eq('id', id).maybeSingle()
      if (!extraCat.error && extraCat.data) {
        const extra = extraCat.data as { categoria_id?: string | null; codigo_barra?: string | null }
        if (extra.categoria_id) setCategoriaId(String(extra.categoria_id))
        if (extra.codigo_barra != null) setCodigoBarra(String(extra.codigo_barra))
      }
      const dim = await leerDimensionesProducto(requireSupabase(), id)
      setAltoCm(dim.altoCm)
      setLargoCm(dim.largoCm)
      setAnchoCm(dim.anchoCm)
      setPesoGr(dim.pesoGr)
      const mov = await listarMovimientosProducto(requireSupabase(), id)
      if (!mov.error) setMovimientos(mov.filas)
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
    const costoNum =
      usaVariantes && costoDesdeVariantes != null
        ? costoDesdeVariantes
        : costo.trim() === ''
          ? null
          : Number(costo.replace(',', '.'))
    if (costoNum != null && (!Number.isFinite(costoNum) || costoNum < 0)) {
      setError('El costo no es válido')
      return
    }
    const stock = Number.parseInt(stockInicial, 10)
    if (esNuevo && !usaVariantes && (!Number.isFinite(stock) || stock < 0)) {
      setError('El stock inicial tiene que ser un número entero')
      return
    }

    const catElegida = categorias.find((c) => c.id === categoriaId)
    const categoriaNombre = catElegida?.nombre ?? categoria.trim()
    const categoriaIdGuardar = catElegida?.id ?? null
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
    if (esNuevo) {
      const creado = await crearProducto(client, {
        nombre: nombre.trim(),
        categoria: categoriaNombre,
        precioVenta: precio,
        costo: costoNum,
        stockInicial: usaVariantes ? 0 : Number.isFinite(stock) ? stock : 0,
        activo,
      })
      if (creado.error || !creado.id) {
        setEnviando(false)
        setError(creado.error || 'No se pudo crear el producto')
        return
      }
      await asignarCategoriaProducto(client, creado.id, categoriaIdGuardar)
      const barraError = await guardarCodigoBarra(client, creado.id, codigoBarra)
      const varError = await variantesRef.current?.persistir(creado.id)
      const dimError = await persistirDimensiones(creado.id)
      setEnviando(false)
      if (barraError || varError || dimError) {
        setError(barraError || varError || dimError)
        navigate(`/productos/${creado.id}`, { replace: true })
        return
      }
      navigate('/productos', { replace: true })
      return
    }
    const fallo = await actualizarProducto(client, {
      id: id!,
      nombre: nombre.trim(),
      categoria: categoriaNombre,
      precioVenta: precio,
      costo: costoNum,
      activo,
    })
    if (fallo) {
      setEnviando(false)
      setError(fallo)
      return
    }
    await asignarCategoriaProducto(client, id!, categoriaIdGuardar)
    const barraError = await guardarCodigoBarra(client, id!, codigoBarra)
    const varError = await variantesRef.current?.persistir(id!)
    const dimError = await persistirDimensiones(id!)
    setEnviando(false)
    if (barraError || varError || dimError) {
      setError(barraError || varError || dimError)
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
      <EscanerCodigoBarras
        activo={escaner}
        onDetected={(codigo) => {
          setCodigoBarra(codigo)
          setEscaner(false)
        }}
        onClose={() => setEscaner(false)}
      />
      <div className={`relative z-10 mx-auto px-4 py-8 ${usaVariantes ? 'max-w-3xl' : 'max-w-[440px]'}`}>
        <AppNav />
        <Breadcrumb
          items={[
            { label: 'Productos', to: '/productos' },
            { label: esNuevo ? 'Nuevo producto' : nombre.trim() || 'Editar producto' },
          ]}
        />
        <div className="rounded-lg bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <h1 className="text-xl font-bold text-[#1A2F4A]">{titulo}</h1>
          {cargando ? (
            <div className="mt-6">
              <PageSkeleton />
            </div>
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
                Código de barras
                <span className="mt-1.5 flex gap-2">
                  <input
                    className="h-11 min-w-0 flex-1 rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]"
                    value={codigoBarra}
                    placeholder="Opcional"
                    onChange={(ev) => setCodigoBarra(ev.target.value)}
                  />
                  <button
                    className="btn-camara"
                    type="button"
                    aria-label="Escanear código de barras"
                    onClick={() => setEscaner(true)}
                  >
                    📷
                  </button>
                </span>
              </label>
              {categorias.length === 0 ? (
                <p className="mt-4 text-sm text-[#4A5568]">
                  Categoría
                  <Link className="mt-1.5 block font-semibold text-[#6366F1]" to="/configuracion?tab=categorias">
                    Configurá tus categorías primero
                  </Link>
                </p>
              ) : (
                <label className="mt-4 text-sm font-medium text-[#4A5568]">
                  Categoría
                  <select
                    className={inputClass}
                    value={categoriaId}
                    onChange={(ev) => {
                      const next = ev.target.value
                      setCategoriaId(next)
                      setCategoria(categorias.find((c) => c.id === next)?.nombre ?? '')
                    }}
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="mt-4 text-sm font-medium text-[#4A5568]">
                {usaVariantes ? 'Precio base (referencial)' : 'Precio de venta (ARS)'}
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={precioVenta}
                  onChange={(ev) => setPrecioVenta(ev.target.value)}
                />
              </label>
              {usaVariantes ? (
                <p className="mt-1.5 text-xs text-[#4A5568]">
                  Con variantes activas, cada variante tiene su propio precio. El precio base se usa
                  como fallback si la variante no tiene precio propio.
                </p>
              ) : null}
              <label className="mt-4 text-sm font-medium text-[#4A5568]">
                {usaVariantes && costoDesdeVariantes != null
                  ? 'Calculado desde variantes'
                  : usaVariantes
                    ? 'Costo base (ARS)'
                    : 'Costo (ARS)'}
                <input
                  className={`${inputClass} ${usaVariantes && costoDesdeVariantes != null ? 'bg-[#E2E8F0] text-[#4A5568]' : ''}`}
                  inputMode="decimal"
                  readOnly={usaVariantes && costoDesdeVariantes != null}
                  value={
                    usaVariantes && costoDesdeVariantes != null
                      ? String(costoDesdeVariantes)
                      : costo
                  }
                  onChange={(ev) => setCosto(ev.target.value)}
                />
              </label>
              {usaVariantes && costoDesdeVariantes != null ? (
                <p className="mt-1.5 text-xs text-[#4A5568]">
                  Promedio ponderado de los costos de las variantes activas.
                </p>
              ) : null}
              {usaVariantes ? null : esNuevo ? (
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
              {usaVariantes && perfil ? (
                <ProductoVariantesEditor
                  ref={variantesRef}
                  productoId={esNuevo ? null : id ?? null}
                  empresaId={perfil.empresa.id}
                  nombreProducto={nombre}
                  precioBase={Number(precioVenta.replace(',', '.')) || 0}
                  costoBase={
                    costoDesdeVariantes != null
                      ? costoDesdeVariantes
                      : costo.trim() === ''
                        ? null
                        : Number(costo.replace(',', '.')) || null
                  }
                  onCostoCalculado={onCostoCalculado}
                />
              ) : null}
              <button
                className="mt-6 flex w-full items-center justify-between text-left text-sm font-bold text-[#1A2F4A]"
                type="button"
                onClick={() => setDimOpen((v) => !v)}
              >
                Dimensiones para envío
                <span className="text-xs font-medium text-[#4A5568]">{dimOpen ? 'Ocultar' : 'Mostrar'}</span>
              </button>
              {dimOpen ? (
                <div className="mt-2 space-y-3">
                  <p className="text-xs text-[#4A5568]">Útil para calcular envíos con Andreani/OCA</p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm font-medium text-[#4A5568]">
                      Alto (cm)
                      <input className={inputClass} inputMode="decimal" value={altoCm} onChange={(ev) => setAltoCm(ev.target.value)} />
                    </label>
                    <label className="text-sm font-medium text-[#4A5568]">
                      Largo (cm)
                      <input className={inputClass} inputMode="decimal" value={largoCm} onChange={(ev) => setLargoCm(ev.target.value)} />
                    </label>
                    <label className="text-sm font-medium text-[#4A5568]">
                      Ancho (cm)
                      <input className={inputClass} inputMode="decimal" value={anchoCm} onChange={(ev) => setAnchoCm(ev.target.value)} />
                    </label>
                    <label className="text-sm font-medium text-[#4A5568]">
                      Peso (gramos)
                      <input className={inputClass} inputMode="decimal" value={pesoGr} onChange={(ev) => setPesoGr(ev.target.value)} />
                    </label>
                  </div>
                </div>
              ) : null}

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
        {!esNuevo && movimientos.length > 0 ? (
          <div className="mt-4 rounded-lg bg-white/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <h2 className="text-sm font-bold text-[#1A2F4A]">Historial de movimientos</h2>
            <ul className="mt-3 overflow-hidden rounded-md">
              {movimientos.map((m) => {
                const e = estiloTipoMovimiento(m.tipo, m.signo)
                const fecha = m.fecha ? new Date(m.fecha).toLocaleString('es-AR') : ''
                const entrada = m.signo >= 0
                return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                    style={{
                      background: 'rgba(15,23,41,0.95)',
                      borderBottom: '1px solid rgba(99,102,241,0.15)',
                      color: '#F1F5F9',
                    }}
                  >
                    <span
                      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: e.fondo, color: e.color }}
                    >
                      {e.icono} {e.texto}
                    </span>
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: entrada ? '#4ADE80' : '#F87171' }}
                    >
                      {entrada ? '+' : '-'}
                      {m.cantidad}
                    </span>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>
                      {m.motivo ? `${m.motivo} · ` : ''}
                      {fecha}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
