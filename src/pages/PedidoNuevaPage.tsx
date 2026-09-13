import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { EscanerCodigoBarras, dispararPedidoCamara } from '../components/EscanerCodigoBarras'
import { VarianteChipsPicker } from '../components/VarianteChipsPicker'
import { crearCliente, listarClientes, type ClienteFila } from '../lib/clientes'
import { obtenerConfiguracion, type ConfiguracionEmpresa } from '../lib/configuracion'
import { mostrarToast } from '../lib/consulta'
import { etiquetaLoteOpcion, lotesDisponiblesProducto, type LoteFila } from '../lib/lotes'
import { armarDireccionEnvio, crearPedido, METODOS_ENVIO, PROVINCIAS_AR } from '../lib/pedidos'
import { esBusquedaCodigoBarras, formatoARS, listarProductos, type ProductoFila } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import {
  listarUbicaciones,
  stockDe,
  stockPorUbicaciones,
  stockPorVarianteUbicaciones,
  textoStockUbicaciones,
  type UbicacionFila,
} from '../lib/ubicaciones'
import {
  etiquetaCombo,
  listarAtributos,
  listarVariantesActivas,
  precioVarianteOBase,
  stockPorVariante,
  type AtributoFila,
  type VarianteFila,
} from '../lib/variantes'
import { theme } from '../theme'
import { useTema } from '../lib/tema'

type Linea = {
  uid: string
  productoId: string
  varianteId: string | null
  nombre: string
  cantidad: number
  precioUnitario: number
  stockLinea: number
  loteId: string | null
  lotes: LoteFila[]
}

const inputClass =
  'min-h-12 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-4 py-3 text-base text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]'

export function PedidoNuevaPage() {
  const { perfil } = useAuth()
  const { tema } = useTema()
  const navigate = useNavigate()
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [catalogo, setCatalogo] = useState<ProductoFila[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [cliente, setCliente] = useState('')
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<ClienteFila[]>([])
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [mostrarAltaCliente, setMostrarAltaCliente] = useState(false)
  const [dropdownCliente, setDropdownCliente] = useState(false)
  const [nuevoTel, setNuevoTel] = useState('')
  const [nombreAlta, setNombreAlta] = useState('')
  const [creandoCliente, setCreandoCliente] = useState(false)
  const [calle, setCalle] = useState('')
  const [altura, setAltura] = useState('')
  const [entreCalles, setEntreCalles] = useState('')
  const [pisoDepto, setPisoDepto] = useState('')
  const [codigoPostal, setCodigoPostal] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [provincia, setProvincia] = useState('')
  const [metodoEnvio, setMetodoEnvio] = useState<(typeof METODOS_ENVIO)[number]>('Retiro en local')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [lineaResaltada, setLineaResaltada] = useState<string | null>(null)
  const [config, setConfig] = useState<ConfiguracionEmpresa | null>(null)
  const comboRef = useRef<HTMLDivElement | null>(null)
  const resaltadoTimer = useRef<number | null>(null)
  const [variantesCatalogo, setVariantesCatalogo] = useState<VarianteFila[]>([])
  const [stockVar, setStockVar] = useState<Map<string, number>>(new Map())
  const [atributosVentas, setAtributosVentas] = useState<AtributoFila[]>([])
  const [picker, setPicker] = useState<ProductoFila | null>(null)
  const [escaner, setEscaner] = useState(false)
  const busquedaRef = useRef<HTMLInputElement | null>(null)
  const [ubicaciones, setUbicaciones] = useState<UbicacionFila[]>([])
  const [ubicacionOrigen, setUbicacionOrigen] = useState('')
  const [stockUbic, setStockUbic] = useState<Map<string, Map<string, number>>>(new Map())
  const [stockVarUbic, setStockVarUbic] = useState<Map<string, Map<string, number>>>(new Map())

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
      const client = requireSupabase()
      const ub = await listarUbicaciones(client)
      setUbicaciones(ub.filas)
      setUbicacionOrigen((prev) => {
        if (prev) return prev
        const def = cfg.ubicacionVentaDefault.trim()
        if (def && ub.filas.some((u) => u.nombre === def)) return def
        return ub.filas[0]?.nombre || ''
      })
      const { filas } = await listarProductos(client)
      const activos = filas.filter((p) => p.activo)
      if (ub.filas.length > 0 && activos.length > 0) {
        setStockUbic(await stockPorUbicaciones(client, activos.map((p) => p.id)))
      }
      if (!cfg.usaVariantes) {
        setVariantesCatalogo([])
        setAtributosVentas([])
        return
      }
      const atr = await listarAtributos(client)
      if (!atr.error) setAtributosVentas(atr.filas.filter((a) => a.activoVentas))
      const vars = await listarVariantesActivas(
        client,
        activos.map((p) => p.id),
      )
      if (!vars.error) {
        setVariantesCatalogo(vars.filas)
        setStockVar(await stockPorVariante(client, vars.filas.map((v) => v.id)))
        if (ub.filas.length > 0 && activos.length > 0) {
          setStockVarUbic(await stockPorVarianteUbicaciones(client, activos.map((p) => p.id)))
        }
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
      if (!comboRef.current?.contains(ev.target as Node)) setDropdownCliente(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0)

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

  function agregarLinea(
    producto: ProductoFila,
    variante: VarianteFila | null,
    lotes: LoteFila[] = [],
    loteIdSel?: string | null,
  ) {
    const varianteId = variante?.id ?? null
    const etiqueta = variante ? ` — ${etiquetaCombo(variante.atributos)}` : ''
    const precio = precioVarianteOBase(variante?.precioVenta, producto.precio_venta)
    const stockUbicacion =
      ubicaciones.length > 0 && (ubicacionOrigen || ubicaciones[0]?.nombre)
        ? variante
          ? stockDe(stockVarUbic, variante.id, ubicacionOrigen || ubicaciones[0]!.nombre)
          : stockDe(stockUbic, producto.id, ubicacionOrigen || ubicaciones[0]!.nombre)
        : null
    const stock =
      stockUbicacion != null
        ? stockUbicacion
        : variante
          ? (stockVar.get(variante.id) ?? 0)
          : producto.stock_actual
    const loteDefault = lotes.find((l) => l.id === loteIdSel) ?? lotes[0] ?? null
    const loteId = loteDefault?.id ?? null
    const uid = crypto.randomUUID()
    setLineas((prev) => {
      const hit = prev.find(
        (l) => l.productoId === producto.id && l.varianteId === varianteId && l.loteId === loteId,
      )
      if (hit) {
        const actualizada = { ...hit, cantidad: hit.cantidad + 1 }
        return [actualizada, ...prev.filter((l) => l.uid !== hit.uid)]
      }
      return [
        {
          uid,
          productoId: producto.id,
          varianteId,
          nombre: `${producto.nombre}${etiqueta}`,
          cantidad: 1,
          precioUnitario: precio,
          stockLinea: stock,
          loteId,
          lotes,
        },
        ...prev,
      ]
    })
    resaltarLinea(uid)
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
    if (config?.usaVariantes && vars.length > 0) {
      setPicker(producto)
      setError(null)
      return
    }
    const lotes = config?.usaLotes
      ? await lotesDisponiblesProducto(requireSupabase(), producto.id, null)
      : []
    agregarLinea(producto, null, lotes)
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

  function cambiarCantidad(uid: string, delta: number) {
    setLineas((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, cantidad: Math.max(1, l.cantidad + delta) } : l)),
    )
  }

  function elegirCliente(c: ClienteFila) {
    setClienteId(c.id)
    setCliente(c.nombre)
    setBusquedaCliente(c.nombre)
    setNuevoTel(c.telefono ?? '')
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
      telefono: nuevoTel.trim(),
      email: '',
      cumpleanos: null,
      notasLibres: '',
      etiquetas: [],
    })
    setCreandoCliente(false)
    if (!id) {
      setError(fallo || 'No se pudo crear el cliente')
      return
    }
    const creado: ClienteFila = {
      id,
      nombre: nom,
      telefono: nuevoTel.trim() || null,
      ultima_compra: null,
      total_gastado: 0,
      cantidad_compras: 0,
      etiquetas: [],
    }
    setClientes((prev) => [creado, ...prev])
    elegirCliente(creado)
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
    setError(null)
    setPaso(2)
  }

  function irPaso3() {
    if (!calle.trim()) {
      setError('Ingresá la calle')
      return
    }
    if (!altura.trim()) {
      setError('Ingresá la altura')
      return
    }
    if (!codigoPostal.trim()) {
      setError('Ingresá el código postal')
      return
    }
    if (!localidad.trim()) {
      setError('Ingresá la localidad')
      return
    }
    if (!provincia.trim()) {
      setError('Elegí la provincia')
      return
    }
    if (!metodoEnvio) {
      setError('Elegí el método de envío')
      return
    }
    setError(null)
    setPaso(3)
  }

  const direccionCompleta = armarDireccionEnvio({
    calle,
    altura,
    entreCalles,
    piso: pisoDepto,
    codigoPostal,
    localidad,
    provincia,
  })

  async function confirmar() {
    if (!perfil) return
    setError(null)
    setEnviando(true)
    const { id, error: fallo } = await crearPedido(requireSupabase(), {
      empresaId: perfil.empresa.id,
      clienteId,
      clienteNombre: cliente.trim() || busquedaCliente.trim(),
      clienteEmail: '',
      clienteTelefono: nuevoTel.trim(),
      direccionEnvio: direccionCompleta,
      codigoPostal,
      localidad,
      provincia,
      metodoEnvio,
      notas,
      items: lineas.map((l) => ({
        productoId: l.productoId,
        varianteId: l.varianteId,
        loteId: l.loteId,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
      })),
    })
    setEnviando(false)
    if (!id) {
      setError(fallo)
      return
    }
    mostrarToast('Pedido creado · Nuevo')
    setExito(true)
    window.setTimeout(() => navigate(`/pedidos/${id}`, { replace: true }), 800)
  }

  if (!perfil) return null

  const oscuro = tema === 'dark'
  const btnCantidad = {
    width: 56,
    height: 56,
    borderRadius: 8,
    border: oscuro ? '1px solid rgba(99,102,241,0.5)' : '1px solid #6366F1',
    background: oscuro ? '#1E2A3A' : '#FFFFFF',
    color: oscuro ? '#F1F5F9' : '#111827',
  } as const
  const numCantidad = { color: oscuro ? '#F1F5F9' : '#111827' } as const

  return (
    <div
      className="relative min-h-dvh"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <ParticleNetwork />
      <EscanerCodigoBarras activo={escaner} onDetected={onCodigoDetectado} onClose={() => setEscaner(false)} />
      <div className="relative z-10 mx-auto max-w-[440px] px-4 py-8 pb-28 md:pb-8">
        <AppNav />
        <div className="rounded-lg bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <h1 className="text-xl font-bold text-[#1A2F4A]">Nuevo pedido</h1>
          <p className="mt-1 text-xs font-medium text-[#4A5568]">Paso {paso} de 3</p>

          {exito ? (
            <p className="mt-6 rounded-md bg-green-50 px-3 py-3 text-sm text-green-800">
              Pedido creado. Abriendo ficha…
            </p>
          ) : (
            <>
              {paso === 1 ? (
                <div className="mt-5">
                  {ubicaciones.length > 1 ? (
                    <label className="mb-4 block text-sm font-medium text-[#4A5568]">
                      Preparar desde ubicación
                      <select
                        className={`${inputClass} mt-1.5`}
                        value={ubicacionOrigen}
                        onChange={(ev) => setUbicacionOrigen(ev.target.value)}
                      >
                        {ubicaciones.map((u) => (
                          <option key={u.id} value={u.nombre}>
                            {u.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
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
                            <span>
                              <span className="block">{p.nombre}</span>
                              <span className="mt-0.5 block text-xs text-[#4A5568]">
                                {textoStockUbicaciones(stockUbic, p.id, ubicaciones, p.stock_actual)}
                              </span>
                            </span>
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
                      etiquetaAccion="Agregar al pedido"
                      ubicaciones={ubicaciones}
                      stockUbicProducto={stockUbic.get(picker.id)}
                      stockUbicVariante={stockVarUbic}
                      cargarLotes={
                        config?.usaLotes
                          ? (productoId, varianteId) =>
                              lotesDisponiblesProducto(requireSupabase(), productoId, varianteId)
                          : undefined
                      }
                      onElegir={(variante, _sel, extra) => {
                        if (!variante) {
                          setError('Seleccioná una variante válida')
                          return
                        }
                        agregarLinea(picker, variante, extra?.lotes ?? [], extra?.loteId)
                      }}
                      onCancelar={() => setPicker(null)}
                    />
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {lineas.map((linea) => {
                      const loteSel = linea.lotes.find((l) => l.id === linea.loteId) ?? null
                      return (
                        <div
                          key={linea.uid}
                          className={`rounded-md border px-3 py-2 ${
                            lineaResaltada === linea.uid
                              ? 'border-[#6366F1] bg-[#EEF2FF]'
                              : 'border-[#E2E8F0] bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-[#1A2F4A]">{linea.nombre}</p>
                            <button
                              className="text-xs text-[#DC2626]"
                              type="button"
                              onClick={() => setLineas((prev) => prev.filter((l) => l.uid !== linea.uid))}
                            >
                              Quitar
                            </button>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              className="flex items-center justify-center text-2xl font-bold"
                              style={btnCantidad}
                              type="button"
                              onClick={() => cambiarCantidad(linea.uid, -1)}
                            >
                              −
                            </button>
                            <span
                              className="flex items-center justify-center text-lg font-semibold"
                              style={{
                                ...numCantidad,
                                minWidth: 56,
                                height: 56,
                                borderRadius: 8,
                                background: oscuro ? '#1E2A3A' : '#FFFFFF',
                              }}
                            >
                              {linea.cantidad}
                            </span>
                            <button
                              className="flex items-center justify-center text-2xl font-bold"
                              style={btnCantidad}
                              type="button"
                              onClick={() => cambiarCantidad(linea.uid, 1)}
                            >
                              +
                            </button>
                            <span className="ml-auto text-sm text-[#1A2F4A]">
                              {formatoARS(linea.cantidad * linea.precioUnitario)}
                            </span>
                          </div>
                          {config?.usaLotes && linea.lotes.length > 0 ? (
                            <label className="mt-2 block text-xs text-[#4A5568]">
                              Lote
                              <select
                                className={`${inputClass} mt-1 min-h-11 py-2 text-sm`}
                                value={linea.loteId ?? ''}
                                onChange={(ev) => {
                                  const id = ev.target.value || null
                                  setLineas((prev) =>
                                    prev.map((l) => (l.uid === linea.uid ? { ...l, loteId: id } : l)),
                                  )
                                }}
                              >
                                {linea.lotes.map((lote) => (
                                  <option key={lote.id} value={lote.id}>
                                    {etiquetaLoteOpcion(lote)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          {loteSel ? (
                            <p className="mt-1 text-xs text-[#4A5568]">
                              Stock del lote: {loteSel.stock}u
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-[#4A5568]">
                              {textoStockUbicaciones(
                                linea.varianteId ? stockVarUbic : stockUbic,
                                linea.varianteId ?? linea.productoId,
                                ubicaciones,
                                linea.stockLinea,
                              )}
                            </p>
                          )}
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
                <div className="mt-5 space-y-3" ref={comboRef}>
                  <p className="text-sm font-medium text-[#4A5568]">Cliente (opcional)</p>
                  <input
                    className={inputClass}
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
                    <ul className="overflow-hidden rounded-md border border-[#E2E8F0] bg-white shadow-sm">
                      {sugeridosClientes.map((c) => (
                        <li key={c.id}>
                          <button
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
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
                      {!existeNombreExacto ? (
                        <li>
                          <button
                            className="w-full border-t border-[#E2E8F0] px-3 py-2 text-left text-sm font-semibold text-[#6366F1]"
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
                  {clienteId ? <p className="text-xs text-[#6366F1]">Cliente vinculado: {cliente}</p> : null}
                  {mostrarAltaCliente ? (
                    <div className="rounded-md border border-[#E2E8F0] p-3">
                      <label className="block text-xs text-[#4A5568]">
                        Nombre
                        <input
                          className={`${inputClass} mt-1 h-9 min-h-9 py-2`}
                          value={nombreAlta}
                          onChange={(ev) => setNombreAlta(ev.target.value)}
                        />
                      </label>
                      <label className="mt-2 block text-xs text-[#4A5568]">
                        Teléfono (opcional)
                        <input
                          className={`${inputClass} mt-1 h-9 min-h-9 py-2`}
                          value={nuevoTel}
                          onChange={(ev) => setNuevoTel(ev.target.value)}
                        />
                      </label>
                      <button
                        className="mt-3 h-10 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white"
                        type="button"
                        disabled={creandoCliente}
                        onClick={() => void crearClienteInline()}
                      >
                        {creandoCliente ? 'CREANDO…' : 'Guardar y seleccionar'}
                      </button>
                    </div>
                  ) : null}
                  <label className="block text-sm font-medium text-[#4A5568]">
                    Calle
                    <input
                      className={`${inputClass} mt-1.5`}
                      value={calle}
                      placeholder='Ej: "San Martín"'
                      onChange={(ev) => setCalle(ev.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#4A5568]">
                    Altura
                    <input
                      className={`${inputClass} mt-1.5`}
                      value={altura}
                      placeholder='Ej: "1234"'
                      onChange={(ev) => setAltura(ev.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#4A5568]">
                    Entre calles (opcional)
                    <input
                      className={`${inputClass} mt-1.5`}
                      value={entreCalles}
                      placeholder='Ej: "Belgrano y Rivadavia"'
                      onChange={(ev) => setEntreCalles(ev.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#4A5568]">
                    Piso/Departamento (opcional)
                    <input
                      className={`${inputClass} mt-1.5`}
                      value={pisoDepto}
                      placeholder='Ej: "3° B"'
                      onChange={(ev) => setPisoDepto(ev.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#4A5568]">
                    Código postal
                    <input
                      className={`${inputClass} mt-1.5`}
                      value={codigoPostal}
                      onChange={(ev) => setCodigoPostal(ev.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#4A5568]">
                    Localidad
                    <input
                      className={`${inputClass} mt-1.5`}
                      value={localidad}
                      onChange={(ev) => setLocalidad(ev.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#4A5568]">
                    Provincia
                    <select
                      className={`${inputClass} mt-1.5`}
                      value={provincia}
                      onChange={(ev) => setProvincia(ev.target.value)}
                    >
                      <option value="">Elegí provincia</option>
                      {PROVINCIAS_AR.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-[#4A5568]">
                    Método de envío
                    <select
                      className={`${inputClass} mt-1.5`}
                      value={metodoEnvio}
                      onChange={(ev) => setMetodoEnvio(ev.target.value as (typeof METODOS_ENVIO)[number])}
                    >
                      {METODOS_ENVIO.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {paso === 3 ? (
                <div className="mt-5 text-sm text-[#1A2F4A]">
                  <p>Vas a crear este pedido:</p>
                  <div className="mt-3 rounded-md bg-[#EEF2F6] px-3 py-3">
                    {lineas.map((l) => (
                      <p key={l.uid}>
                        {l.nombre} × {l.cantidad} — {formatoARS(l.cantidad * l.precioUnitario)}
                      </p>
                    ))}
                    <p className="mt-2 font-semibold">Total {formatoARS(total)}</p>
                    {cliente.trim() || busquedaCliente.trim() ? (
                      <p>Cliente: {cliente.trim() || busquedaCliente.trim()}</p>
                    ) : null}
                    {direccionCompleta ? <p>{direccionCompleta}</p> : null}
                    <p>{metodoEnvio}</p>
                  </div>
                  <label className="mt-4 block text-sm font-medium text-[#4A5568]">
                    Notas
                    <textarea
                      className={`${inputClass} mt-1.5 min-h-24 py-2`}
                      value={notas}
                      onChange={(ev) => setNotas(ev.target.value)}
                    />
                  </label>
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
                    onClick={irPaso3}
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
                    {enviando ? 'GUARDANDO…' : 'Crear pedido'}
                  </button>
                ) : null}
              </div>
            </>
          )}

          <Link className="mt-4 block text-center text-sm font-medium text-[#6366F1]" to="/pedidos">
            Volver al listado
          </Link>
        </div>
      </div>
    </div>
  )
}
