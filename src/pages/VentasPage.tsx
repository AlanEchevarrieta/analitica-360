import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  BadgePago,
  IconBtn,
  PAGE_VENTAS,
  PageTitle,
  PaginacionBar,
  TableCard,
  TableErrorRed,
  TableSkeleton,
  Th,
  ThFilter,
  Tr,
  btnPrimary,
  theadClass,
  theadStyle,
} from '../components/listado'
import { rangoPreset } from '../lib/analytics'
import { MSG_ERROR_RED, mensajeCargaTabla } from '../lib/consulta'
import { formatoARS, listarProductosNombres } from '../lib/productos'
import { tienePermiso } from '../lib/permisos'
import { requireSupabase } from '../lib/supabase'
import {
  FORMAS_PAGO,
  anularVenta,
  formatoFechaVenta,
  listarVentasPaginado,
  resumenVentasHoy,
  type VentaFila,
} from '../lib/ventas'
import { theme } from '../theme'

function etiquetaCuotas(n: number) {
  if (n <= 1) return 'Contado'
  return `${n} cuotas`
}

function rangoMes() {
  return rangoPreset('mes')
}

export function VentasPage() {
  const { perfil } = useAuth()
  const [filas, setFilas] = useState<VentaFila[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [productos, setProductos] = useState<{ id: string; nombre: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [anulando, setAnulando] = useState<string | null>(null)
  const [hoy, setHoy] = useState({ cantidad: 0, total: 0 })
  const inicial = rangoMes()
  const [desde, setDesde] = useState(inicial.desde)
  const [hasta, setHasta] = useState(inicial.hasta)
  const [productoId, setProductoId] = useState('')
  const [forma, setForma] = useState('')
  const [cliente, setCliente] = useState('')
  const [menu, setMenu] = useState<'pago' | 'cliente' | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  const cargar = useCallback(async () => {
    setCargando(true)
    const client = requireSupabase()
    const [{ filas: data, total: n, error: listError }, resumen] = await Promise.all([
      listarVentasPaginado(client, {
        pagina,
        pageSize: PAGE_VENTAS,
        desde,
        hasta,
        forma,
        cliente,
        productoId,
      }),
      resumenVentasHoy(client),
    ])
    setCargando(false)
    setHoy(resumen)
    if (listError) {
      const msg = mensajeCargaTabla(listError)
      if (msg) {
        setError(
          msg === MSG_ERROR_RED
            ? MSG_ERROR_RED
            : 'No se pudieron cargar las ventas. Corré supabase/007_ventas.sql en el SQL Editor.',
        )
      }
      return
    }
    setError(null)
    setFilas(data)
    setTotal(n)
  }, [pagina, desde, hasta, forma, cliente, productoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    void listarProductosNombres(requireSupabase()).then((prods) => {
      if (!prods.error) setProductos(prods.filas)
    })
  }, [])

  const subtitulo = useMemo(
    () => `${hoy.cantidad} ${hoy.cantidad === 1 ? 'venta' : 'ventas'} hoy · ${formatoARS(hoy.total)} total hoy`,
    [hoy],
  )

  if (!perfil) return null

  const puedeAnular = tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'anular_ventas')

  async function onAnular(id: string) {
    setError(null)
    setAnulando(id)
    const fallo = await anularVenta(requireSupabase(), id)
    setAnulando(null)
    if (fallo) {
      setError(fallo)
      return
    }
    await cargar()
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
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        <AppNav />
        <PageTitle titulo="Ventas" subtitulo={subtitulo} />

        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="filter-bar mb-0">
            <div className="filter-field">
              <label htmlFor="venta-desde">Desde</label>
              <input
                id="venta-desde"
                className="filter-control"
                type="date"
                value={desde}
                onChange={(ev) => {
                  setPagina(1)
                  setDesde(ev.target.value)
                }}
              />
            </div>
            <div className="filter-field">
              <label htmlFor="venta-hasta">Hasta</label>
              <input
                id="venta-hasta"
                className="filter-control"
                type="date"
                value={hasta}
                onChange={(ev) => {
                  setPagina(1)
                  setHasta(ev.target.value)
                }}
              />
            </div>
            <div className="filter-field min-w-[200px]">
              <label htmlFor="venta-producto">Producto</label>
              <select
                id="venta-producto"
                className="filter-control"
                value={productoId}
                onChange={(ev) => {
                  setPagina(1)
                  setProductoId(ev.target.value)
                }}
              >
                <option value="">Todos los productos</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Link className={btnPrimary} to="/ventas/nueva">
            Nueva venta
          </Link>
        </div>

        {error && error !== MSG_ERROR_RED ? (
          <p className="mb-6 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}

        <TableCard>
          <table className="w-full min-w-[860px] text-left">
            <thead className={theadClass} style={theadStyle}>
              <tr>
                <Th>Fecha</Th>
                <Th>Productos</Th>
                <Th>Total</Th>
                <ThFilter
                  label="Forma de pago"
                  active={Boolean(forma)}
                  open={menu === 'pago'}
                  onToggle={() => setMenu((m) => (m === 'pago' ? null : 'pago'))}
                  onClose={closeMenu}
                >
                  <button
                    className={`col-filter-option${forma === '' ? ' selected' : ''}`}
                    type="button"
                    onClick={() => {
                      setPagina(1)
                      setForma('')
                      closeMenu()
                    }}
                  >
                    Todas
                  </button>
                  {FORMAS_PAGO.map((f) => (
                    <button
                      key={f.id}
                      className={`col-filter-option${forma === f.id ? ' selected' : ''}`}
                      type="button"
                      onClick={() => {
                        setPagina(1)
                        setForma(f.id)
                        closeMenu()
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </ThFilter>
                <Th>Cuotas</Th>
                <ThFilter
                  label="Cliente"
                  active={Boolean(cliente.trim())}
                  open={menu === 'cliente'}
                  onToggle={() => setMenu((m) => (m === 'cliente' ? null : 'cliente'))}
                  onClose={closeMenu}
                >
                  <input
                    className="col-filter-search"
                    type="search"
                    placeholder="Buscar por nombre"
                    value={cliente}
                    autoFocus
                    onChange={(ev) => {
                      setPagina(1)
                      setCliente(ev.target.value)
                    }}
                  />
                </ThFilter>
                {puedeAnular ? <Th /> : null}
              </tr>
            </thead>
            {!cargando && error !== MSG_ERROR_RED ? (
            <tbody>
              {filas.map((fila, index) => (
                <Tr key={fila.id} index={index}>
                  <td className="px-3 py-3 whitespace-nowrap">{formatoFechaVenta(fila.fecha)}</td>
                  <td className="px-3 py-3">{fila.productos || '—'}</td>
                  <td className="px-3 py-3 font-bold text-[#4ADE80]">{formatoARS(fila.total)}</td>
                  <td className="px-3 py-3">
                    <BadgePago forma={fila.forma_pago} />
                  </td>
                  <td className="px-3 py-3">{etiquetaCuotas(fila.cuotas)}</td>
                  <td className="px-3 py-3">
                    {fila.cliente ? (
                      <span>👤 {fila.cliente}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  {puedeAnular ? (
                    <td className="px-3 py-3">
                      <IconBtn
                        label="Anular venta"
                        hoverOnly
                        onClick={() => void onAnular(fila.id)}
                      >
                        {anulando === fila.id ? '…' : '🗑️'}
                      </IconBtn>
                    </td>
                  ) : null}
                </Tr>
              ))}
            </tbody>
            ) : null}
          </table>
          {cargando ? <TableSkeleton /> : null}
          {!cargando && error === MSG_ERROR_RED ? (
            <TableErrorRed onReintentar={() => void cargar()} />
          ) : null}
          {!cargando && filas.length === 0 && !error ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              {total === 0 ? 'Todavía no hay ventas.' : 'Ninguna venta coincide con los filtros.'}
            </p>
          ) : null}
        </TableCard>
        {!cargando && error !== MSG_ERROR_RED ? (
        <PaginacionBar
          pagina={pagina}
          total={total}
          pageSize={PAGE_VENTAS}
          onPagina={setPagina}
          entidad="ventas"
        />
        ) : null}
      </div>
    </div>
  )
}
