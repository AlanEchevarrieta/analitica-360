import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { listarClientes, type ClienteFila } from '../lib/clientes'
import { obtenerConfiguracion, type ConfiguracionEmpresa } from '../lib/configuracion'
import { tienePermiso } from '../lib/permisos'
import { formatoARS, listarProductos, type ProductoFila } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'
import {
  etiquetaCombo,
  listarVariantesActivas,
  precioVarianteOBase,
  stockPorVariante,
  type VarianteFila,
} from '../lib/variantes'
import { confirmarVenta, rankingVentasPorProducto } from '../lib/ventas'

const PAGOS = [
  { id: 'efectivo', icono: '💵', label: 'Efectivo' },
  { id: 'transferencia', icono: '📱', label: 'Transferencia' },
  { id: 'debito', icono: '💳', label: 'Débito' },
  { id: 'credito', icono: '💳', label: 'Crédito' },
] as const

export function VentaRapidaPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [config, setConfig] = useState<ConfiguracionEmpresa | null>(null)
  const [cargando, setCargando] = useState(true)
  const [productos, setProductos] = useState<ProductoFila[]>([])
  const [variantes, setVariantes] = useState<VarianteFila[]>([])
  const [stockVar, setStockVar] = useState<Map<string, number>>(new Map())
  const [busqueda, setBusqueda] = useState('')
  const [paso, setPaso] = useState<1 | 2>(1)
  const [producto, setProducto] = useState<ProductoFila | null>(null)
  const [variante, setVariante] = useState<VarianteFila | null>(null)
  const [chipsDe, setChipsDe] = useState<string | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [formaPago, setFormaPago] = useState<(typeof PAGOS)[number]['id']>('efectivo')
  const [clientes, setClientes] = useState<ClienteFila[]>([])
  const [mostrarCliente, setMostrarCliente] = useState(false)
  const [qCliente, setQCliente] = useState('')
  const [cliente, setCliente] = useState<ClienteFila | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!perfil) return
    const client = requireSupabase()
    void (async () => {
      const [{ config: cfg }, { filas }, ranking] = await Promise.all([
        obtenerConfiguracion(client, perfil.empresa.id),
        listarProductos(client),
        rankingVentasPorProducto(client),
      ])
      setConfig(cfg)
      const activos = filas.filter((p) => p.activo)
      activos.sort((a, b) => (ranking.get(b.id) ?? 0) - (ranking.get(a.id) ?? 0) || a.nombre.localeCompare(b.nombre, 'es'))
      setProductos(activos)
      if (cfg.usaVariantes && activos.length > 0) {
        const vars = await listarVariantesActivas(
          client,
          activos.map((p) => p.id),
        )
        if (!vars.error) {
          setVariantes(vars.filas)
          setStockVar(await stockPorVariante(client, vars.filas.map((v) => v.id)))
        }
      }
      setCargando(false)
    })()
  }, [perfil])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return productos
    return productos.filter((p) => p.nombre.toLowerCase().includes(q))
  }, [busqueda, productos])

  const clientesFiltrados = useMemo(() => {
    const q = qCliente.trim().toLowerCase()
    if (!q) return clientes.slice(0, 6)
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q) || (c.telefono ?? '').includes(q)).slice(0, 6)
  }, [clientes, qCliente])

  const precio = producto ? precioVarianteOBase(variante?.precioVenta, producto.precio_venta) : 0
  const total = precio * cantidad
  const stockMostrar = variante ? (stockVar.get(variante.id) ?? 0) : (producto?.stock_actual ?? 0)

  function resetPaso1() {
    setPaso(1)
    setProducto(null)
    setVariante(null)
    setChipsDe(null)
    setCantidad(1)
    setFormaPago('efectivo')
    setMostrarCliente(false)
    setQCliente('')
    setCliente(null)
    setError(null)
    setCopiado(false)
  }

  function elegirProducto(p: ProductoFila) {
    const vars = variantes.filter((v) => v.productoId === p.id)
    if (config?.usaVariantes && vars.length > 0) {
      setProducto(p)
      setChipsDe(p.id)
      setVariante(null)
      return
    }
    setProducto(p)
    setVariante(null)
    setChipsDe(null)
    setPaso(2)
  }

  function elegirVariante(p: ProductoFila, v: VarianteFila) {
    setProducto(p)
    setVariante(v)
    setChipsDe(null)
    setPaso(2)
  }

  async function abrirClientes() {
    setMostrarCliente(true)
    if (clientes.length === 0) {
      const { filas } = await listarClientes(requireSupabase())
      setClientes(filas)
    }
  }

  async function copiarAlias() {
    const alias = config?.aliasTransferencia ?? ''
    if (!alias) return
    try {
      await navigator.clipboard.writeText(alias)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1500)
    } catch {
      setError('No se pudo copiar el alias')
    }
  }

  async function cobrar() {
    if (!producto || enviando) return
    if (config?.usaVariantes && variantes.some((v) => v.productoId === producto.id) && !variante) {
      setError('Elegí una variante')
      return
    }
    setEnviando(true)
    setError(null)
    const fallo = await confirmarVenta(requireSupabase(), {
      items: [
        {
          producto_id: producto.id,
          cantidad,
          precio_unitario: precio,
          variante_id: variante?.id ?? null,
        },
      ],
      formaPago,
      descuento: 0,
      cliente: cliente?.nombre ?? '',
      clienteId: cliente?.id ?? null,
      cuotas: formaPago === 'credito' ? 1 : 1,
      coeficienteInteres: 0,
      totalSinInteres: total,
      totalConInteres: total,
    })
    setEnviando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    const monto = formatoARS(total)
    setExito(`✅ ${monto} cobrado`)
    window.setTimeout(() => {
      setExito(null)
      resetPaso1()
    }, 1500)
  }

  if (!perfil) return null
  if (!tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'registrar_ventas')) {
    return <Navigate to="/inicio" replace />
  }
  if (!cargando && config && !config.usaModoFeria) {
    return <Navigate to="/inicio" replace />
  }

  return (
    <div
      className="relative min-h-dvh px-4 py-4"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <button
        type="button"
        className="text-sm font-semibold text-[#A5B4FC]"
        onClick={() => (paso === 2 ? resetPaso1() : navigate('/inicio'))}
      >
        ← Volver
      </button>

      {cargando ? (
        <p className="mt-10 text-center text-sm text-[#94A3B8]">Cargando…</p>
      ) : paso === 1 ? (
        <div className="mx-auto mt-4 max-w-lg pb-8">
          <h1 className="text-2xl font-bold text-[#F1F5F9]">¿Qué vendiste?</h1>
          {productos.length > 8 ? (
            <input
              className="mt-4 h-12 w-full rounded-xl border border-[rgba(99,102,241,0.35)] bg-white/10 px-4 text-base text-[#F1F5F9] outline-none placeholder:text-[#94A3B8] focus:border-[#6366F1]"
              value={busqueda}
              placeholder="Buscar producto"
              onChange={(ev) => setBusqueda(ev.target.value)}
            />
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {visibles.map((p) => {
              const vars = variantes.filter((v) => v.productoId === p.id)
              const abierto = chipsDe === p.id
              return (
                <div key={p.id} className={abierto ? 'col-span-2' : 'col-span-1'}>
                  <button
                    type="button"
                    className="flex min-h-[108px] w-full flex-col items-start rounded-xl border border-[rgba(99,102,241,0.25)] bg-white/5 p-3 text-left"
                    onClick={() => elegirProducto(p)}
                  >
                    <span className="text-base font-bold leading-snug text-[#F1F5F9]">{p.nombre}</span>
                    <span className="mt-1 text-sm font-semibold text-[#4ADE80]">{formatoARS(p.precio_venta)}</span>
                    <span className="mt-auto pt-2 text-xs text-[#94A3B8]">Stock {p.stock_actual}</span>
                  </button>
                  {abierto && vars.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {vars.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          className="min-h-12 rounded-xl bg-[#6366F1] px-3 text-sm font-semibold text-white"
                          onClick={() => elegirVariante(p, v)}
                        >
                          {etiquetaCombo(v.atributos)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          {visibles.length === 0 ? (
            <p className="mt-8 text-center text-sm text-[#94A3B8]">No hay productos para mostrar.</p>
          ) : null}
        </div>
      ) : producto ? (
        <div className="mx-auto mt-4 max-w-lg pb-8">
          <p className="text-xl font-bold text-[#F1F5F9]">
            {producto.nombre}
            {variante ? ` — ${etiquetaCombo(variante.atributos)}` : ''}
          </p>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {formatoARS(precio)} · Stock {stockMostrar}
          </p>

          <p className="mt-6 text-sm font-medium text-[#94A3B8]">Cantidad</p>
          <div className="mt-2 flex items-center justify-center gap-6">
            <button
              type="button"
              className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-3xl text-[#F1F5F9]"
              onClick={() => setCantidad((n) => Math.max(1, n - 1))}
            >
              −
            </button>
            <span className="min-w-12 text-center text-[32px] font-bold text-[#F1F5F9]">{cantidad}</span>
            <button
              type="button"
              className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-3xl text-[#F1F5F9]"
              onClick={() => setCantidad((n) => n + 1)}
            >
              +
            </button>
          </div>

          <p className="mt-6 text-sm font-medium text-[#94A3B8]">Forma de pago</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {PAGOS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex min-h-16 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold"
                style={
                  formaPago === p.id
                    ? { background: '#6366F1', color: '#fff', borderColor: '#6366F1' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', borderColor: 'rgba(99,102,241,0.3)' }
                }
                onClick={() => setFormaPago(p.id)}
              >
                {p.icono} {p.label}
              </button>
            ))}
          </div>

          {formaPago === 'transferencia' ? (
            <div className="mt-3 rounded-xl border border-[rgba(99,102,241,0.25)] bg-white/5 px-3 py-3">
              <p className="text-xs text-[#94A3B8]">Alias</p>
              <p className="mt-1 break-all text-base font-semibold text-[#F1F5F9]">
                {config?.aliasTransferencia || 'Configurá el alias en Configuración → Modo Feria'}
              </p>
              {config?.aliasTransferencia ? (
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold text-[#A5B4FC]"
                  onClick={() => void copiarAlias()}
                >
                  {copiado ? '✓ Copiado' : '📋 Copiar alias'}
                </button>
              ) : (
                <Link className="mt-2 inline-block text-sm font-semibold text-[#A5B4FC]" to="/configuracion?tab=feria">
                  Ir a configuración
                </Link>
              )}
            </div>
          ) : null}

          <p className="mt-6 text-center text-3xl font-bold text-[#4ADE80]">Total: {formatoARS(total)}</p>

          <button
            type="button"
            className="mt-3 text-sm font-medium text-[#94A3B8]"
            onClick={() => void abrirClientes()}
          >
            + Agregar cliente (opcional)
          </button>
          {cliente ? (
            <p className="mt-1 text-sm text-[#A5B4FC]">
              {cliente.nombre}{' '}
              <button type="button" className="underline" onClick={() => setCliente(null)}>
                quitar
              </button>
            </p>
          ) : null}
          {mostrarCliente && !cliente ? (
            <div className="mt-2">
              <input
                className="h-12 w-full rounded-xl border border-[rgba(99,102,241,0.35)] bg-white/10 px-4 text-base text-[#F1F5F9] outline-none"
                value={qCliente}
                placeholder="Buscar cliente"
                onChange={(ev) => setQCliente(ev.target.value)}
              />
              <ul className="mt-2 overflow-hidden rounded-xl border border-[rgba(99,102,241,0.2)]">
                {clientesFiltrados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-3 text-left text-sm text-[#F1F5F9] hover:bg-white/10"
                      onClick={() => {
                        setCliente(c)
                        setMostrarCliente(false)
                      }}
                    >
                      {c.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? <p className="mt-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}

          <button
            type="button"
            disabled={enviando}
            className="mt-6 flex h-16 w-full items-center justify-center rounded-xl bg-[#16A34A] text-lg font-bold text-white disabled:opacity-60"
            onClick={() => void cobrar()}
          >
            {enviando ? 'Cobrando…' : '✓ COBRADO'}
          </button>
        </div>
      ) : null}

      {exito ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <p
            className="text-center text-3xl font-bold text-[#4ADE80]"
            style={{ animation: 'feria-check 0.45s ease-out' }}
          >
            {exito}
          </p>
        </div>
      ) : null}
    </div>
  )
}
