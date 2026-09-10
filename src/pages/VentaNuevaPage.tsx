import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  FLUJO_VENTAS_DEFAULT,
  etiquetaMedioPago,
  idMedioAVenta,
  MEDIOS_PAGO,
  obtenerConfiguracion,
  ordenarCuotasParaVenta,
  TASAS_CUOTAS_DEFAULT,
  type ConfiguracionEmpresa,
  type TasaCuota,
} from '../lib/configuracion'
import { crearCliente, listarClientes, type ClienteFila } from '../lib/clientes'
import { EscanerCodigoBarras, dispararPedidoCamara } from '../components/EscanerCodigoBarras'
import { formatoARS, esBusquedaCodigoBarras, listarProductos, type ProductoFila } from '../lib/productos'
import { mostrarToast } from '../lib/consulta'
import { requireSupabase } from '../lib/supabase'
import { calcularTotalesCredito, confirmarVenta } from '../lib/ventas'
import {
  etiquetaCombo,
  listarAtributos,
  listarVariantesActivas,
  precioVarianteOBase,
  stockPorVariante,
  type AtributoFila,
  type VarianteFila,
} from '../lib/variantes'
import { VarianteChipsPicker } from '../components/VarianteChipsPicker'
import { theme } from '../theme'

type Linea = {
  productoId: string
  varianteId: string | null
  nombre: string
  cantidad: number
  precioUnitario: number
  stockLinea: number
}

function claveLinea(productoId: string, varianteId: string | null) {
  return varianteId ? `${productoId}:${varianteId}` : productoId
}

const inputClass =
  'min-h-12 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-4 py-3 text-base text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]'

export function VentaNuevaPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [catalogo, setCatalogo] = useState<ProductoFila[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [descuento, setDescuento] = useState('0')
  const [formaPago, setFormaPago] = useState('efectivo')
  const [cliente, setCliente] = useState('')
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<ClienteFila[]>([])
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [mostrarAltaCliente, setMostrarAltaCliente] = useState(false)
  const [dropdownCliente, setDropdownCliente] = useState(false)
  const [nuevoTel, setNuevoTel] = useState('')
  const [nombreAlta, setNombreAlta] = useState('')
  const [creandoCliente, setCreandoCliente] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [lineaResaltada, setLineaResaltada] = useState<string | null>(null)
  const [config, setConfig] = useState<ConfiguracionEmpresa | null>(null)
  const [cuotaIndex, setCuotaIndex] = useState(0)
  const [coeficiente, setCoeficiente] = useState('0')
  const comboRef = useRef<HTMLDivElement | null>(null)
  const resaltadoTimer = useRef<number | null>(null)
  const [variantesCatalogo, setVariantesCatalogo] = useState<VarianteFila[]>([])
  const [stockVar, setStockVar] = useState<Map<string, number>>(new Map())
  const [atributosVentas, setAtributosVentas] = useState<AtributoFila[]>([])
  const [picker, setPicker] = useState<ProductoFila | null>(null)
  const [escaner, setEscaner] = useState(false)
  const busquedaRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void listarProductos(requireSupabase()).then(({ filas }) => {
      setCatalogo(filas.filter((p) => p.activo))
    })
    void listarClientes(requireSupabase()).then(({ filas }) => {
      setClientes(filas)
    })
  }, [])

  useEffect(() => {
    if (!perfil) return
    void obtenerConfiguracion(requireSupabase(), perfil.empresa.id).then(async ({ config: cfg }) => {
      setConfig(cfg)
      if (!cfg.usaVariantes) {
        setVariantesCatalogo([])
        setAtributosVentas([])
        return
      }
      const atr = await listarAtributos(requireSupabase())
      if (!atr.error) setAtributosVentas(atr.filas.filter((a) => a.activoVentas))
      const { filas } = await listarProductos(requireSupabase())
      const activos = filas.filter((p) => p.activo)
      const vars = await listarVariantesActivas(
        requireSupabase(),
        activos.map((p) => p.id),
      )
      if (vars.error) {
        console.log('[variantes] venta: no se pudieron cargar variantes', vars.error)
      } else {
        setVariantesCatalogo(vars.filas)
        setStockVar(await stockPorVariante(requireSupabase(), vars.filas.map((v) => v.id)))
      }
    })
  }, [perfil])

  const sugeridos = useMemo(() => {
    const raw = busqueda.trim()
    const q = raw.toLowerCase()
    if (!q) return catalogo.slice(0, 8)
    const porBarra = esBusquedaCodigoBarras(raw)
    return catalogo
      .filter((p) => {
        if (p.nombre.toLowerCase().includes(q)) return true
        if (porBarra && p.codigo_barra === raw) return true
        return false
      })
      .slice(0, 8)
  }, [busqueda, catalogo])

  const flujo = config?.flujoVentas ?? FLUJO_VENTAS_DEFAULT
  const mostrarCampoCliente = flujo.mostrarCliente !== 'no_mostrar'
  const clienteObligatorio = flujo.mostrarCliente === 'siempre'

  const sugeridosClientes = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase()
    const qTel = q.replace(/\s/g, '')
    if (!q) return []
    return clientes
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) || (c.telefono ?? '').replace(/\s/g, '').includes(qTel),
      )
      .slice(0, 5)
  }, [busquedaCliente, clientes])

  const existeNombreExacto = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase()
    if (!q) return false
    return clientes.some((c) => c.nombre.toLowerCase() === q)
  }, [busquedaCliente, clientes])

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!comboRef.current?.contains(ev.target as Node)) {
        setDropdownCliente(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const subtotal = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0)
  const desc = Math.max(0, Number(descuento.replace(',', '.')) || 0)
  const total = Math.max(0, subtotal - desc)
  const mediosActivos = useMemo(() => {
    const ids = new Set((config?.mediosPago ?? MEDIOS_PAGO.map((m) => m.id)).map(idMedioAVenta))
    return MEDIOS_PAGO.filter((m) => ids.has(m.ventaId))
  }, [config])

  const cuotasActivas = useMemo(
    () => ordenarCuotasParaVenta(config?.tasasCuotas ?? TASAS_CUOTAS_DEFAULT),
    [config],
  )

  const cuotaElegida: TasaCuota | null = cuotasActivas[cuotaIndex] ?? cuotasActivas[0] ?? null
  const coefNum = Math.max(0, Number(coeficiente.replace(',', '.')) || 0)
  const credito = formaPago === 'credito'
  const totalesCredito = calcularTotalesCredito(total, coefNum, cuotaElegida?.cuotas ?? 1)
  const totalACobrar = credito ? Number(totalesCredito.totalConInteres.toFixed(2)) : total

  useEffect(() => {
    if (mediosActivos.length === 0) return
    if (!mediosActivos.some((m) => m.ventaId === formaPago)) {
      setFormaPago(mediosActivos[0].ventaId)
    }
  }, [mediosActivos, formaPago])

  useEffect(() => {
    if (!credito || cuotasActivas.length === 0) return
    if (cuotaIndex >= cuotasActivas.length) {
      setCuotaIndex(0)
      setCoeficiente(String(cuotasActivas[0].tasa))
    }
  }, [credito, cuotasActivas, cuotaIndex])

  useEffect(() => {
    return () => {
      if (resaltadoTimer.current != null) window.clearTimeout(resaltadoTimer.current)
    }
  }, [])

  function resaltarLinea(clave: string) {
    setLineaResaltada(clave)
    if (resaltadoTimer.current != null) window.clearTimeout(resaltadoTimer.current)
    resaltadoTimer.current = window.setTimeout(() => setLineaResaltada(null), 1600)
  }

  function agregarLinea(producto: ProductoFila, variante: VarianteFila | null) {
    const varianteId = variante?.id ?? null
    const etiqueta = variante ? ` — ${etiquetaCombo(variante.atributos)}` : ''
    const precio = precioVarianteOBase(variante?.precioVenta, producto.precio_venta)
    console.log('[variantes] precio al agregar a la venta', {
      productoId: producto.id,
      productoPrecioBase: producto.precio_venta,
      varianteId,
      varianteAtributos: variante?.atributos ?? null,
      variantePrecio: variante?.precioVenta ?? null,
      precioUsado: precio,
    })
    const stock = variante ? (stockVar.get(variante.id) ?? 0) : producto.stock_actual
    const clave = claveLinea(producto.id, varianteId)
    setLineas((prev) => {
      const existente = prev.find((l) => claveLinea(l.productoId, l.varianteId) === clave)
      if (existente) {
        const actualizada = { ...existente, cantidad: existente.cantidad + 1 }
        return [actualizada, ...prev.filter((l) => claveLinea(l.productoId, l.varianteId) !== clave)]
      }
      return [
        {
          productoId: producto.id,
          varianteId,
          nombre: `${producto.nombre}${etiqueta}`,
          cantidad: 1,
          precioUnitario: precio,
          stockLinea: stock,
        },
        ...prev,
      ]
    })
    resaltarLinea(clave)
    setBusqueda('')
    setError(null)
    setPicker(null)
  }

  async function agregarProducto(producto: ProductoFila) {
    let vars = variantesCatalogo.filter((v) => v.productoId === producto.id)
    if (config?.usaVariantes && vars.length === 0) {
      const rec = await listarVariantesActivas(requireSupabase(), [producto.id])
      if (!rec.error && rec.filas.length > 0) {
        vars = rec.filas
        setVariantesCatalogo((prev) => [
          ...prev.filter((v) => v.productoId !== producto.id),
          ...rec.filas,
        ])
        const stock = await stockPorVariante(
          requireSupabase(),
          rec.filas.map((v) => v.id),
        )
        setStockVar((prev) => {
          const next = new Map(prev)
          for (const [id, n] of stock) next.set(id, n)
          return next
        })
      }
    }
    console.log('[variantes] producto seleccionado en venta', {
      productoId: producto.id,
      variantes: vars,
    })
    if (config?.usaVariantes && vars.length > 0) {
      setPicker(producto)
      setError(null)
      return
    }
    agregarLinea(producto, null)
  }

  function onCodigoDetectado(codigo: string) {
    const hit = catalogo.find((p) => p.codigo_barra === codigo)
    if (hit) {
      void agregarProducto(hit)
      return
    }
    setBusqueda(codigo)
    mostrarToast('Código no encontrado — agregá el producto manualmente')
    window.setTimeout(() => busquedaRef.current?.focus(), 50)
  }

  function cambiarCantidad(clave: string, delta: number) {
    setLineas((prev) =>
      prev.map((l) =>
        claveLinea(l.productoId, l.varianteId) === clave
          ? { ...l, cantidad: Math.max(1, l.cantidad + delta) }
          : l,
      ),
    )
  }

  function elegirCliente(c: ClienteFila) {
    setClienteId(c.id)
    setCliente(c.nombre)
    setBusquedaCliente(c.nombre)
    setMostrarAltaCliente(false)
    setDropdownCliente(false)
    setError(null)
  }

  async function crearClienteInline() {
    const nom = nombreAlta.trim() || busquedaCliente.trim()
    if (!nom) {
      setError('Ingresá el nombre del cliente')
      return
    }
    setCreandoCliente(true)
    const { id, error: fallo } = await crearCliente(requireSupabase(), {
      nombre: nom,
      telefono: nuevoTel,
      email: '',
      cumpleanos: null,
      notasLibres: '',
      etiquetas: ['Nuevo'],
    })
    setCreandoCliente(false)
    if (fallo || !id) {
      setError(fallo || 'No se pudo crear el cliente')
      return
    }
    const creado: ClienteFila = {
      id,
      nombre: nom,
      telefono: nuevoTel || null,
      ultima_compra: null,
      total_gastado: 0,
      cantidad_compras: 0,
      etiquetas: ['Nuevo'],
    }
    setClientes((prev) => [creado, ...prev])
    elegirCliente(creado)
    setNuevoTel('')
    setNombreAlta('')
  }

  function elegirCuotas(index: number) {
    const opcion = cuotasActivas[index]
    if (!opcion) return
    setCuotaIndex(index)
    setCoeficiente(String(opcion.tasa))
  }

  function irPaso2() {
    if (picker) {
      setError('Completá la variante del producto antes de continuar')
      return
    }
    if (lineas.length === 0) {
      setError('Agregá al menos un producto')
      return
    }
    if (lineas.some((l) => l.cantidad < 1 || l.precioUnitario < 0)) {
      setError('Revisá cantidad y precio de cada línea')
      return
    }
    setError(null)
    setPaso(2)
  }

  async function confirmar() {
    if (clienteObligatorio && !clienteId) {
      setError('Seleccioná un cliente para continuar')
      return
    }
    setError(null)
    setEnviando(true)
    const fallo = await confirmarVenta(requireSupabase(), {
      items: lineas.map((l) => ({
        producto_id: l.productoId,
        cantidad: l.cantidad,
        precio_unitario: l.precioUnitario,
        variante_id: l.varianteId,
      })),
      formaPago,
      descuento: desc,
      cliente: mostrarCampoCliente ? cliente : '',
      clienteId: mostrarCampoCliente ? clienteId : null,
      cuotas: credito ? (cuotaElegida?.cuotas ?? 1) : 1,
      coeficienteInteres: credito ? coefNum : 0,
      totalSinInteres: total,
      totalConInteres: totalACobrar,
    })
    setEnviando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setExito(true)
    window.setTimeout(() => navigate('/inicio', { replace: true }), 1200)
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
      <EscanerCodigoBarras
        activo={escaner}
        onDetected={onCodigoDetectado}
        onClose={() => setEscaner(false)}
      />
      <div className="relative z-10 mx-auto max-w-[440px] px-4 py-8 pb-28 md:pb-8">
        <AppNav />
        <div className="rounded-lg bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <h1 className="text-xl font-bold text-[#1A2F4A]">Nueva venta</h1>
          <p className="mt-1 text-xs font-medium text-[#4A5568]">Paso {paso} de 3</p>

          {exito ? (
            <p className="mt-6 rounded-md bg-green-50 px-3 py-3 text-sm text-green-800">
              Venta registrada. Volviendo al inicio…
            </p>
          ) : (
            <>
              {paso === 1 ? (
                <div className="mt-5">
                  <label className="block w-full text-sm font-medium text-[#4A5568]">
                    Buscar producto
                    <span className="mt-1.5 flex gap-2">
                      <input
                        ref={busquedaRef}
                        className={inputClass}
                        value={busqueda}
                        placeholder="Buscar producto..."
                        onChange={(ev) => setBusqueda(ev.target.value)}
                      />
                      <button
                        className="btn-camara"
                        type="button"
                        aria-label="Escanear código de barras"
                        onClick={() => {
                          dispararPedidoCamara()
                          setEscaner(true)
                        }}
                      >
                        📷
                      </button>
                    </span>
                  </label>
                  {sugeridos.length > 0 ? (
                    <ul className="mt-2 max-h-40 overflow-auto rounded-md border border-[#E2E8F0]">
                      {sugeridos.map((p) => (
                        <li key={p.id}>
                          <button
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[#1A2F4A] hover:bg-[#EEF2F6]"
                            type="button"
                            onClick={() => void agregarProducto(p)}
                          >
                            <span>{p.nombre}</span>
                            <span className="text-[#4A5568]">{formatoARS(p.precio_venta)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-[#4A5568]">No hay productos activos para mostrar.</p>
                  )}

                  {picker ? (
                    <VarianteChipsPicker
                      producto={picker}
                      variantes={variantesCatalogo.filter((v) => v.productoId === picker.id)}
                      stockPorId={stockVar}
                      clavesVisibles={atributosVentas.map((a) => a.nombre)}
                      exigirStock
                      etiquetaAccion="Agregar a la venta"
                      onElegir={(variante) => {
                        if (variante) agregarLinea(picker, variante)
                        else setError('Seleccioná una variante válida')
                      }}
                      onCancelar={() => setPicker(null)}
                    />
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {lineas.map((linea) => {
                      const clave = claveLinea(linea.productoId, linea.varianteId)
                      return (
                      <div
                        key={clave}
                        className={`rounded-md border px-3 py-2 transition-colors duration-300 ${
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
                              setLineas((prev) =>
                                prev.filter((l) => claveLinea(l.productoId, l.varianteId) !== clave),
                              )
                            }
                          >
                            Quitar
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              className="flex h-11 w-11 items-center justify-center rounded-md border border-[#E2E8F0] text-lg font-bold text-[#1A2F4A]"
                              type="button"
                              aria-label="Quitar uno"
                              onClick={() => cambiarCantidad(clave, -1)}
                            >
                              −
                            </button>
                            <span className="min-w-8 text-center text-base font-semibold text-[#1A2F4A]">
                              {linea.cantidad}
                            </span>
                            <button
                              className="flex h-11 w-11 items-center justify-center rounded-md border border-[#E2E8F0] text-lg font-bold text-[#1A2F4A]"
                              type="button"
                              aria-label="Agregar uno"
                              onClick={() => cambiarCantidad(clave, 1)}
                            >
                              +
                            </button>
                          </div>
                          <label className="min-w-0 flex-1 text-xs text-[#4A5568]">
                            Precio
                            <input
                              className={`${inputClass} mt-1 min-h-11 py-2 text-sm`}
                              inputMode="decimal"
                              value={linea.precioUnitario}
                              onChange={(ev) => {
                                const n = Number(ev.target.value.replace(',', '.'))
                                setLineas((prev) =>
                                  prev.map((l) =>
                                    claveLinea(l.productoId, l.varianteId) === clave
                                      ? { ...l, precioUnitario: Number.isFinite(n) ? n : 0 }
                                      : l,
                                  ),
                                )
                              }}
                            />
                          </label>
                        </div>
                        <p className="mt-2 text-xs text-[#4A5568]">
                          Stock disponible: {linea.stockLinea}{' '}
                          {linea.stockLinea === 1 ? 'unidad' : 'unidades'}
                        </p>
                        {linea.cantidad > linea.stockLinea ? (
                          <p className="mt-1 text-xs text-[#EA580C]">
                            ⚠️ Superás el stock disponible ({linea.stockLinea}). Podés confirmar igual.
                          </p>
                        ) : null}
                        <p className="mt-2 text-right text-sm text-[#1A2F4A]">
                          Subtotal {formatoARS(linea.cantidad * linea.precioUnitario)}
                        </p>
                      </div>
                      )
                    })}
                  </div>

                  <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                    Descuento (ARS)
                    <input
                      className={`${inputClass} mt-1.5`}
                      inputMode="decimal"
                      value={descuento}
                      onChange={(ev) => setDescuento(ev.target.value)}
                    />
                  </label>
                  <p className="mt-3 text-right text-sm font-semibold text-[#1A2F4A]">
                    Total {formatoARS(total)}
                  </p>
                </div>
              ) : null}

              {paso === 2 ? (
                <div className="mt-5">
                  <p className="text-sm font-medium text-[#4A5568]">Forma de pago</p>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {mediosActivos.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`rounded-md border px-3 py-2 text-left text-sm ${
                          formaPago === f.ventaId
                            ? 'border-[#6366F1] bg-[#EEF2FF] font-semibold text-[#1A2F4A]'
                            : 'border-[#E2E8F0] text-[#4A5568]'
                        }`}
                        onClick={() => {
                          setFormaPago(f.ventaId)
                          if (f.ventaId === 'credito' && cuotasActivas[0]) {
                            setCuotaIndex(0)
                            setCoeficiente(String(cuotasActivas[0].tasa))
                          }
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {formaPago === 'credito' ? (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-[#4A5568]">Cuotas</p>
                      {cuotasActivas.length === 0 ? (
                        <p className="mt-2 text-sm text-[#4A5568]">
                          No hay cuotas activas. El dueño puede activarlas en Configuración.
                        </p>
                      ) : (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {cuotasActivas.map((o, index) => (
                            <button
                              key={`${o.cuotas}-${o.label}-${index}`}
                              type="button"
                              className={`rounded-md border px-3 py-2 text-left text-sm ${
                                (cuotaElegida?.cuotas === o.cuotas && cuotaElegida.label === o.label)
                                  ? 'border-[#6366F1] bg-[#EEF2FF] font-semibold text-[#1A2F4A]'
                                  : 'border-[#E2E8F0] text-[#4A5568]'
                              }`}
                              onClick={() => elegirCuotas(index)}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                        Coeficiente de interés %
                        <input
                          className={`${inputClass} mt-1.5`}
                          inputMode="decimal"
                          value={coeficiente}
                          onChange={(ev) => setCoeficiente(ev.target.value)}
                        />
                      </label>
                      <div className="mt-3 space-y-1 rounded-md bg-[#EEF2FF] px-3 py-3 text-sm text-[#1A2F4A]">
                        <p>Total sin interés: {formatoARS(total)}</p>
                        <p>Interés aplicado: {formatoARS(totalesCredito.interes)}</p>
                        <p className="font-semibold">
                          Total con interés: {formatoARS(totalesCredito.totalConInteres)}
                        </p>
                        <p>
                          Valor de cada cuota:{' '}
                          {(cuotaElegida?.cuotas ?? 0) > 0
                            ? formatoARS(totalesCredito.valorCuota)
                            : formatoARS(totalesCredito.totalConInteres)}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {mostrarCampoCliente ? (
                    <div className="mt-4" ref={comboRef}>
                      <p className="text-sm font-medium text-[#4A5568]">
                        {clienteObligatorio ? 'Cliente' : 'Cliente (opcional)'}
                      </p>
                      <input
                        className={`${inputClass} mt-1.5`}
                        value={busquedaCliente}
                        placeholder="Buscar cliente por nombre o teléfono..."
                        onFocus={() => {
                          if (busquedaCliente.trim()) setDropdownCliente(true)
                        }}
                        onChange={(ev) => {
                          const v = ev.target.value
                          setBusquedaCliente(v)
                          setClienteId(null)
                          setCliente('')
                          setMostrarAltaCliente(false)
                          setDropdownCliente(v.trim().length > 0)
                        }}
                      />
                      {dropdownCliente && busquedaCliente.trim() && !mostrarAltaCliente ? (
                        <ul className="mt-1 overflow-hidden rounded-md border border-[#E2E8F0] bg-white shadow-sm">
                          {sugeridosClientes.map((c) => (
                            <li key={c.id}>
                              <button
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[#1A2F4A] hover:bg-[#EEF2F6]"
                                type="button"
                                onClick={() => elegirCliente(c)}
                              >
                                <span>{c.nombre}</span>
                                <span className="text-[#4A5568]">{c.telefono ?? ''}</span>
                              </button>
                            </li>
                          ))}
                          {sugeridosClientes.length === 0 ? (
                            <li className="px-3 py-2 text-xs text-[#4A5568]">Ningún cliente coincide</li>
                          ) : null}
                          {flujo.crearDesdeVenta && !existeNombreExacto ? (
                            <li>
                              <button
                                className="w-full border-t border-[#E2E8F0] px-3 py-2 text-left text-sm font-semibold text-[#6366F1] hover:bg-[#EEF2FF]"
                                type="button"
                                onClick={() => {
                                  setNombreAlta(busquedaCliente.trim())
                                  setMostrarAltaCliente(true)
                                  setDropdownCliente(false)
                                }}
                              >
                                ➕ Crear cliente: {busquedaCliente.trim()}
                              </button>
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                      {clienteId ? (
                        <p className="mt-1.5 text-xs text-[#6366F1]">Cliente vinculado: {cliente}</p>
                      ) : null}
                      {mostrarAltaCliente ? (
                        <div className="mt-2 rounded-md border border-[#E2E8F0] p-3">
                          <label className="block text-xs text-[#4A5568]">
                            Nombre
                            <input
                              className={`${inputClass} mt-1 h-9`}
                              value={nombreAlta}
                              onChange={(ev) => setNombreAlta(ev.target.value)}
                            />
                          </label>
                          <label className="mt-2 block text-xs text-[#4A5568]">
                            Teléfono (opcional)
                            <input
                              className={`${inputClass} mt-1 h-9`}
                              value={nuevoTel}
                              onChange={(ev) => setNuevoTel(ev.target.value)}
                            />
                          </label>
                          <button
                            className="mt-3 h-10 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                            type="button"
                            disabled={creandoCliente}
                            onClick={() => void crearClienteInline()}
                          >
                            {creandoCliente ? 'CREANDO…' : 'Guardar y seleccionar'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-md bg-[#EEF2F6] px-3 py-3 text-sm text-[#1A2F4A]">
                    {lineas.map((l) => (
                      <p key={l.productoId}>
                        {l.nombre} × {l.cantidad} — {formatoARS(l.cantidad * l.precioUnitario)}
                      </p>
                    ))}
                    {desc > 0 ? <p className="mt-1">Descuento: −{formatoARS(desc)}</p> : null}
                    {credito && coefNum > 0 ? (
                      <>
                        <p className="mt-1">Total sin interés: {formatoARS(total)}</p>
                        <p>Interés: {formatoARS(totalesCredito.interes)}</p>
                      </>
                    ) : null}
                    <p className="mt-2 font-semibold">Total final {formatoARS(totalACobrar)}</p>
                    <p className="mt-1 text-[#4A5568]">{etiquetaMedioPago(formaPago)}</p>
                  </div>
                </div>
              ) : null}

              {paso === 3 ? (
                <div className="mt-5 text-sm text-[#1A2F4A]">
                  <p>Vas a registrar esta venta:</p>
                  <div className="mt-3 rounded-md bg-[#EEF2F6] px-3 py-3">
                    {lineas.map((l) => (
                      <p key={l.productoId}>
                        {l.nombre} × {l.cantidad}
                      </p>
                    ))}
                    <p className="mt-2 font-semibold">Total {formatoARS(totalACobrar)}</p>
                    <p>{etiquetaMedioPago(formaPago)}</p>
                    {mostrarCampoCliente && cliente.trim() ? <p>Cliente: {cliente.trim()}</p> : null}
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}

              <div className="venta-sticky-bar md:static md:mx-0 md:mb-0 md:mt-5 md:border-0 md:bg-transparent md:p-0">
                {paso > 1 ? (
                  <button
                    className="h-12 flex-1 rounded-md border border-[#E2E8F0] text-sm font-semibold text-[#4A5568]"
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
                    className="h-12 flex-1 rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5]"
                    type="button"
                    onClick={irPaso2}
                  >
                    Siguiente
                  </button>
                ) : null}
                {paso === 2 ? (
                  <button
                    className="h-12 flex-1 rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5]"
                    type="button"
                    onClick={() => {
                      if (formaPago === 'credito' && cuotasActivas.length === 0) {
                        setError('No hay cuotas activas para tarjeta de crédito')
                        return
                      }
                      if (clienteObligatorio && !clienteId) {
                        setError('Seleccioná un cliente para continuar')
                        return
                      }
                      setError(null)
                      setPaso(3)
                    }}
                  >
                    Siguiente
                  </button>
                ) : null}
                {paso === 3 ? (
                  <button
                    className="h-12 flex-1 rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                    type="button"
                    disabled={enviando}
                    onClick={() => void confirmar()}
                  >
                    {enviando ? 'GUARDANDO…' : 'CONFIRMAR VENTA'}
                  </button>
                ) : null}
              </div>
            </>
          )}

          <Link className="mt-4 block text-center text-sm font-medium text-[#6366F1]" to="/ventas">
            Volver al listado
          </Link>
        </div>
      </div>
    </div>
  )
}
