import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { VarianteChipsPicker } from '../components/VarianteChipsPicker'
import {
  confirmarCompra,
  crearProductoParaCompra,
  hoyCompraISO,
} from '../lib/compras'
import { obtenerConfiguracion } from '../lib/configuracion'
import { formatoARS, listarProductos, type ProductoFila } from '../lib/productos'
import {
  crearProveedor,
  etiquetaProveedor,
  listarProveedoresEmpresa,
  type ProveedorFila,
} from '../lib/proveedores'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'
import {
  asegurarVariante,
  etiquetaCombo,
  listarAtributos,
  listarVariantesDeProductos,
  stockPorVariante,
  type AtributoFila,
  type VarianteFila,
} from '../lib/variantes'
import { crearLote, prefijoLoteMes, sugerenciaNumeroLote } from '../lib/lotes'

type Linea = {
  uid: string
  productoId: string
  varianteId: string | null
  nombre: string
  cantidad: number
  costoUnitario: number
}

function claveLinea(productoId: string, varianteId: string | null) {
  return varianteId ? `${productoId}:${varianteId}` : productoId
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
  const [proveedorId, setProveedorId] = useState<string | null>(null)
  const [proveedores, setProveedores] = useState<ProveedorFila[]>([])
  const [dropdownProveedor, setDropdownProveedor] = useState(false)
  const [mostrarAltaProveedor, setMostrarAltaProveedor] = useState(false)
  const [nombreAltaProv, setNombreAltaProv] = useState('')
  const [telAltaProv, setTelAltaProv] = useState('')
  const [creandoProveedor, setCreandoProveedor] = useState(false)
  const comboProvRef = useRef<HTMLDivElement>(null)
  const comboProdRef = useRef<HTMLDivElement>(null)
  const [fecha, setFecha] = useState(hoyCompraISO)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [nuevoCategoria, setNuevoCategoria] = useState('')
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [dropdownProducto, setDropdownProducto] = useState(false)
  const [creandoProducto, setCreandoProducto] = useState(false)
  const [lineaResaltada, setLineaResaltada] = useState<string | null>(null)
  const resaltadoTimer = useRef<number | null>(null)
  const [usaVariantes, setUsaVariantes] = useState(false)
  const [usaLotes, setUsaLotes] = useState(false)
  const [loteCompraAbierto, setLoteCompraAbierto] = useState(false)
  const [compraNumeroLote, setCompraNumeroLote] = useState('')
  const [compraElab, setCompraElab] = useState('')
  const [compraVenc, setCompraVenc] = useState('')
  const [variantesCatalogo, setVariantesCatalogo] = useState<VarianteFila[]>([])
  const [stockVar, setStockVar] = useState<Map<string, number>>(new Map())
  const [atributosVentas, setAtributosVentas] = useState<AtributoFila[]>([])
  const [picker, setPicker] = useState<ProductoFila | null>(null)

  async function recargarCatalogo() {
    const { filas } = await listarProductos(requireSupabase())
    setCatalogo(filas)
    return filas
  }

  useEffect(() => {
    void recargarCatalogo()
    void listarProveedoresEmpresa(requireSupabase()).then(({ filas }) => {
      setProveedores(filas)
    })
  }, [])

  useEffect(() => {
    if (!perfil) return
    void obtenerConfiguracion(requireSupabase(), perfil.empresa.id).then(async ({ config }) => {
      const usa = Boolean(config.usaVariantes)
      setUsaVariantes(usa)
      setUsaLotes(Boolean(config.usaLotes))
      if (config.usaLotes) {
        const sug = await sugerenciaNumeroLote(requireSupabase(), perfil.empresa.id)
        setCompraNumeroLote((prev) => prev || sug)
      }
      if (!usa) {
        setVariantesCatalogo([])
        setAtributosVentas([])
        return
      }
      const atr = await listarAtributos(requireSupabase())
      if (!atr.error) setAtributosVentas(atr.filas.filter((a) => a.activoVentas))
      const { filas } = await listarProductos(requireSupabase())
      const vars = await listarVariantesDeProductos(
        requireSupabase(),
        filas.map((p) => p.id),
      )
      if (!vars.error) {
        setVariantesCatalogo(vars.filas)
        setStockVar(await stockPorVariante(requireSupabase(), vars.filas.map((v) => v.id)))
      }
    })
  }, [perfil])

  const sugeridosProveedores = useMemo(() => {
    const q = proveedor.trim().toLowerCase()
    if (!q) return []
    return proveedores
      .filter((p) => {
        const etiqueta = etiquetaProveedor(p).toLowerCase()
        const razon = (p.razon_social ?? '').toLowerCase()
        const comercial = (p.nombre_comercial ?? '').toLowerCase()
        const nombre = p.nombre.toLowerCase()
        return etiqueta.includes(q) || razon.includes(q) || comercial.includes(q) || nombre.includes(q)
      })
      .slice(0, 5)
  }, [proveedor, proveedores])

  const existeNombreExactoProv = useMemo(() => {
    const q = proveedor.trim().toLowerCase()
    if (!q) return false
    return proveedores.some((p) => etiquetaProveedor(p).toLowerCase() === q)
  }, [proveedor, proveedores])

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!comboProvRef.current?.contains(ev.target as Node)) setDropdownProveedor(false)
      if (!comboProdRef.current?.contains(ev.target as Node)) setDropdownProducto(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
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

  const coincidenciaExacta = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return false
    return catalogo.some((p) => p.nombre.toLowerCase() === q)
  }, [busqueda, catalogo])

  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.costoUnitario, 0)

  function resaltarLinea(clave: string) {
    setLineaResaltada(clave)
    if (resaltadoTimer.current != null) window.clearTimeout(resaltadoTimer.current)
    resaltadoTimer.current = window.setTimeout(() => setLineaResaltada(null), 1600)
  }

  function agregarLinea(producto: ProductoFila, variante: VarianteFila | null) {
    const varianteId = variante?.id ?? null
    const etiqueta = variante ? ` — ${etiquetaCombo(variante.atributos)}` : ''
    const costo = variante && variante.costo != null ? variante.costo : producto.costo
    const k = claveLinea(producto.id, varianteId)
    const existente = lineas.find((l) => claveLinea(l.productoId, l.varianteId) === k)
    if (existente) {
      setLineas((prev) => [
        { ...existente, cantidad: existente.cantidad + 1 },
        ...prev.filter((l) => l.uid !== existente.uid),
      ])
      resaltarLinea(existente.uid)
      setBusqueda('')
      setMostrarNuevo(false)
      setDropdownProducto(false)
      setPicker(null)
      setError(null)
      return
    }
    const uid = crypto.randomUUID()
    setLineas((prev) => [
      {
        uid,
        productoId: producto.id,
        varianteId,
        nombre: `${producto.nombre}${etiqueta}`,
        cantidad: 1,
        costoUnitario: costo,
      },
      ...prev,
    ])
    resaltarLinea(uid)
    setBusqueda('')
    setMostrarNuevo(false)
    setDropdownProducto(false)
    setPicker(null)
    setError(null)
  }

  function productoRequiereVariante(producto: ProductoFila) {
    if (!usaVariantes) return false
    return variantesCatalogo.some((v) => v.productoId === producto.id && v.activo)
  }

  function agregarProducto(producto: ProductoFila) {
    if (productoRequiereVariante(producto)) {
      setPicker(producto)
      setDropdownProducto(false)
      setError(null)
      return
    }
    agregarLinea(producto, null)
  }

  async function confirmarVarianteCompra(variante: VarianteFila | null, sel: Record<string, string>) {
    if (!picker || !perfil) return
    if (variante) {
      agregarLinea(picker, variante)
      return
    }
    const creado = await asegurarVariante(requireSupabase(), {
      productoId: picker.id,
      empresaId: perfil.empresa.id,
      atributos: sel,
      precioVenta: picker.precio_venta,
      costo: picker.costo,
      nombreProducto: picker.nombre,
    })
    if (creado.error || !creado.fila) {
      setError(creado.error || 'No se pudo crear la variante')
      return
    }
    setVariantesCatalogo((prev) => [...prev.filter((v) => v.id !== creado.fila!.id), creado.fila!])
    agregarLinea(picker, creado.fila)
  }

  async function crearProductoInline() {
    const nombre = nuevoNombre.trim() || busqueda.trim()
    const precioRaw = nuevoPrecio.trim()
    const precio = precioRaw === '' ? 0 : Number(precioRaw.replace(',', '.'))
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
      categoria: nuevoCategoria.trim(),
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
      categoria: nuevoCategoria.trim() || null,
      categoria_id: null,
      activo: true,
      precio_venta: precio,
      costo: 0,
      stock_actual: 0,
      codigo_barra: null,
    }
    setNuevoNombre('')
    setNuevoPrecio('')
    setNuevoCategoria('')
    setMostrarNuevo(false)
    setDropdownProducto(false)
    if (usaVariantes && atributosVentas.length > 0) {
      setPicker(creado)
      setBusqueda('')
      return
    }
    agregarLinea(creado, null)
  }

  async function crearProveedorInline() {
    const nom = nombreAltaProv.trim()
    if (!nom) {
      setError('El nombre del proveedor es obligatorio')
      return
    }
    setError(null)
    setCreandoProveedor(true)
    const { id, error: fallo } = await crearProveedor(requireSupabase(), {
      razonSocial: nom,
      nombreComercial: '',
      cuit: '',
      condicionAfip: '',
      telefono: telAltaProv,
      email: '',
      nombreVendedor: '',
      productosQueProvee: '',
      condicionesPago: '',
      formasPagoAceptadas: [],
      plazoEntrega: '',
      cbu: '',
      aliasCbu: '',
      banco: '',
      notas: '',
      activo: true,
    })
    setCreandoProveedor(false)
    if (fallo || !id) {
      setError(fallo || 'No se pudo crear el proveedor')
      return
    }
    const creado: ProveedorFila = {
      id,
      nombre: nom,
      razon_social: nom,
      nombre_comercial: null,
      cuit: null,
      condicion_afip: null,
      nombre_vendedor: null,
      telefono: telAltaProv || null,
      email: null,
      productos_que_provee: null,
      condiciones_pago: null,
      formas_pago_aceptadas: [],
      plazo_entrega: null,
      cbu: null,
      alias_cbu: null,
      banco: null,
      notas: null,
      activo: true,
    }
    setProveedores((prev) => [creado, ...prev])
    setProveedor(nom)
    setProveedorId(id)
    setMostrarAltaProveedor(false)
    setTelAltaProv('')
    setNombreAltaProv('')
  }

  async function irPaso2() {
    if (picker) {
      setError('Completá la variante del producto antes de continuar')
      return
    }
    if (lineas.length === 0) {
      setError('Agregá al menos un producto')
      return
    }
    if (lineas.some((l) => l.cantidad < 1 || l.costoUnitario < 0)) {
      setError('Revisá cantidad y costo de cada línea')
      return
    }
    if (usaLotes && perfil) {
      const sug = await sugerenciaNumeroLote(requireSupabase(), perfil.empresa.id)
      const pref = prefijoLoteMes()
      const auto = new RegExp(`^${pref}-\\d{3}$`)
      const actual = compraNumeroLote.trim()
      const siguiente = !actual || auto.test(actual) ? sug : actual
      setCompraNumeroLote(siguiente)
      if (!siguiente) {
        setError('El número de lote es obligatorio')
        return
      }
    }
    setError(null)
    setPaso(2)
  }

  async function confirmar() {
    if (!perfil) return
    setError(null)
    setEnviando(true)
    const items: {
      producto_id: string
      producto_nombre: string
      cantidad: number
      costo_unitario: number
      variante_id: string | null
      lote_id: string | null
    }[] = []
    for (const l of lineas) {
      let loteId: string | null = null
      if (usaLotes) {
        const creado = await crearLote(requireSupabase(), {
          empresaId: perfil.empresa.id,
          productoId: l.productoId,
          varianteId: l.varianteId,
          numeroLote: compraNumeroLote,
          fechaElaboracion: compraElab || null,
          fechaVencimiento: compraVenc || null,
          cantidadInicial: l.cantidad,
          proveedorId,
          registrarMovimiento: false,
        })
        if (creado.error || !creado.id) {
          setEnviando(false)
          setError(creado.error || 'No se pudo crear el lote')
          return
        }
        loteId = creado.id
      }
      items.push({
        producto_id: l.productoId,
        producto_nombre: l.nombre,
        cantidad: l.cantidad,
        costo_unitario: l.costoUnitario,
        variante_id: l.varianteId,
        lote_id: loteId,
      })
    }
    const fallo = await confirmarCompra(requireSupabase(), {
      items,
      proveedor,
      proveedorId,
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
                  <div ref={comboProdRef}>
                    <label className="text-sm font-medium text-[#4A5568]">
                      Buscar producto
                      <input
                        className={`${inputClass} mt-1.5`}
                        value={busqueda}
                        placeholder="Nombre del producto"
                        onFocus={() => {
                          if (busqueda.trim()) setDropdownProducto(true)
                        }}
                        onChange={(ev) => {
                          setBusqueda(ev.target.value)
                          setMostrarNuevo(false)
                          setDropdownProducto(true)
                        }}
                      />
                    </label>
                    {dropdownProducto && busqueda.trim() ? (
                      <ul className="mt-2 max-h-48 overflow-auto rounded-md border border-[#E2E8F0]">
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
                        {busqueda.trim() && !coincidenciaExacta ? (
                          <li>
                            <button
                              className="w-full px-3 py-2 text-left text-sm font-semibold text-[#6366F1] hover:bg-[#EEF2F6]"
                              type="button"
                              onClick={() => {
                                setMostrarNuevo(true)
                                setNuevoNombre(busqueda.trim())
                                setDropdownProducto(false)
                              }}
                            >
                              ➕ Crear producto: {busqueda.trim()}
                            </button>
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                    {!dropdownProducto && !busqueda.trim() && catalogo.length === 0 ? (
                      <p className="mt-2 text-xs text-[#4A5568]">No hay productos en el catálogo.</p>
                    ) : null}
                  </div>

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
                        Categoría (opcional)
                        <input
                          className={`${inputClass} mt-1 h-9`}
                          value={nuevoCategoria}
                          onChange={(ev) => setNuevoCategoria(ev.target.value)}
                        />
                      </label>
                      <label className="mt-2 block text-xs text-[#4A5568]">
                        Precio de venta base (opcional)
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
                        {creandoProducto ? 'CREANDO…' : 'Guardar y seleccionar'}
                      </button>
                    </div>
                  ) : null}

                  {picker ? (
                    <VarianteChipsPicker
                      producto={picker}
                      variantes={variantesCatalogo.filter((v) => v.productoId === picker.id && v.activo)}
                      stockPorId={stockVar}
                      clavesVisibles={atributosVentas.map((a) => a.nombre)}
                      atributosCatalogo={atributosVentas}
                      exigirStock={false}
                      etiquetaAccion="Agregar a la compra"
                      onElegir={(variante, sel) => void confirmarVarianteCompra(variante, sel)}
                      onCancelar={() => setPicker(null)}
                    />
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {lineas.map((linea) => {
                      const clave = linea.uid
                      return (
                      <div
                        key={clave}
                        className={`rounded-md border p-3 transition-colors duration-300 ${
                          lineaResaltada === clave
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
                              setLineas((prev) => prev.filter((l) => l.uid !== clave))
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
                                    l.uid === clave
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
                                    l.uid === clave
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
                      )
                    })}
                  </div>
                  <p className="mt-3 text-right text-sm font-semibold text-[#1A2F4A]">
                    Total {formatoARS(total)}
                  </p>
                </div>
              ) : null}

              {paso === 2 ? (
                <div className="mt-5 space-y-4">
                  {usaLotes ? (
                    <div className="rounded-md border border-[#E2E8F0]">
                      <button
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-[#1A2F4A]"
                        type="button"
                        onClick={() => setLoteCompraAbierto((v) => !v)}
                      >
                        Lote de esta compra
                        <span className="text-xs text-[#4A5568]">{loteCompraAbierto ? '▾' : '▸'}</span>
                      </button>
                      {loteCompraAbierto ? (
                        <div className="space-y-2 border-t border-[#E2E8F0] px-3 py-3">
                          <label className="block text-xs text-[#4A5568]">
                            N° de lote
                            <input
                              className={`${inputClass} mt-1 h-9`}
                              value={compraNumeroLote}
                              onChange={(ev) => setCompraNumeroLote(ev.target.value)}
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs text-[#4A5568]">
                              Fecha de elaboración
                              <input
                                className={`${inputClass} mt-1 h-9`}
                                type="date"
                                value={compraElab}
                                onChange={(ev) => setCompraElab(ev.target.value)}
                              />
                            </label>
                            <label className="text-xs text-[#4A5568]">
                              Fecha de vencimiento
                              <input
                                className={`${inputClass} mt-1 h-9`}
                                type="date"
                                value={compraVenc}
                                onChange={(ev) => setCompraVenc(ev.target.value)}
                              />
                            </label>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div ref={comboProvRef}>
                    <p className="text-sm font-medium text-[#4A5568]">Proveedor (opcional)</p>
                    <input
                      className={`${inputClass} mt-1.5`}
                      value={proveedor}
                      placeholder="Buscar proveedor por nombre..."
                      onFocus={() => {
                        if (proveedor.trim() && !proveedorId) setDropdownProveedor(true)
                      }}
                      onChange={(ev) => {
                        const v = ev.target.value
                        setProveedor(v)
                        setProveedorId(null)
                        setMostrarAltaProveedor(false)
                        setDropdownProveedor(v.trim().length > 0)
                      }}
                    />
                    {dropdownProveedor && proveedor.trim() && !mostrarAltaProveedor && !proveedorId ? (
                      <ul className="mt-1 overflow-hidden rounded-md border border-[#E2E8F0] bg-white shadow-sm">
                        {sugeridosProveedores.map((p) => (
                          <li key={p.id}>
                            <button
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[#1A2F4A] hover:bg-[#EEF2F6]"
                              type="button"
                              onClick={() => {
                                setProveedor(etiquetaProveedor(p))
                                setProveedorId(p.id)
                                setDropdownProveedor(false)
                              }}
                            >
                              <span>{etiquetaProveedor(p)}</span>
                              <span className="text-[#4A5568]">{p.telefono ?? ''}</span>
                            </button>
                          </li>
                        ))}
                        {sugeridosProveedores.length === 0 ? (
                          <li className="px-3 py-2 text-xs text-[#4A5568]">Ningún proveedor coincide</li>
                        ) : null}
                        {!existeNombreExactoProv ? (
                          <li>
                            <button
                              className="w-full border-t border-[#E2E8F0] px-3 py-2 text-left text-sm font-semibold text-[#6366F1] hover:bg-[#EEF2FF]"
                              type="button"
                              onClick={() => {
                                setNombreAltaProv(proveedor.trim())
                                setMostrarAltaProveedor(true)
                                setDropdownProveedor(false)
                              }}
                            >
                              ➕ Crear proveedor nuevo: {proveedor.trim()}
                            </button>
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                    {proveedorId ? (
                      <p className="mt-1.5 text-xs text-[#6366F1]">Proveedor vinculado: {proveedor}</p>
                    ) : null}
                    {mostrarAltaProveedor ? (
                      <div className="mt-2 rounded-md border border-[#E2E8F0] p-3">
                        <label className="block text-xs text-[#4A5568]">
                          Nombre
                          <input
                            className={`${inputClass} mt-1 h-9`}
                            value={nombreAltaProv}
                            onChange={(ev) => setNombreAltaProv(ev.target.value)}
                          />
                        </label>
                        <label className="mt-2 block text-xs text-[#4A5568]">
                          Teléfono (opcional)
                          <input
                            className={`${inputClass} mt-1 h-9`}
                            value={telAltaProv}
                            onChange={(ev) => setTelAltaProv(ev.target.value)}
                          />
                        </label>
                        <button
                          className="mt-3 h-10 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                          type="button"
                          disabled={creandoProveedor}
                          onClick={() => void crearProveedorInline()}
                        >
                          {creandoProveedor ? 'CREANDO…' : 'Guardar y seleccionar'}
                        </button>
                      </div>
                    ) : null}
                  </div>
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
                      <p key={l.uid}>
                        {l.nombre} × {l.cantidad} — {formatoARS(l.cantidad * l.costoUnitario)}
                        {usaLotes && compraNumeroLote ? ` · ${compraNumeroLote}` : ''}
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
                      <p key={l.uid}>
                        {l.nombre} × {l.cantidad} — {formatoARS(l.cantidad * l.costoUnitario)}
                        {usaLotes && compraNumeroLote ? ` · ${compraNumeroLote}` : ''}
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
                    onClick={() => void irPaso2()}
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
