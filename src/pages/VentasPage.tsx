import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { AnularVentaModal } from '../components/AnularVentaModal'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  BadgePago,
  IconBtn,
  PAGE_VENTAS,
  PageTitle,
  PaginacionBar,
  SearchField,
  TableCard,
  TableErrorRed,
  TableSkeleton,
  Th,
  ThFilter,
  Tr,
  btnPrimary,
  btnPrimaryDesk,
  FabLink,
  FilterCollapse,
  ListCard,
  MobileCards,
  EmptyState,
  theadClass,
  theadStyle,
} from '../components/listado'
import { ImportarVentasModal } from '../components/ImportarVentasModal'
import { rangoPreset } from '../lib/analytics'
import { MSG_ERROR_RED, mensajeCargaTabla } from '../lib/consulta'
import { exportarVentasExcel, exportarVentasPdf } from '../lib/exportarReportes'
import { formatoARS, listarProductosNombres } from '../lib/productos'
import { tienePermiso } from '../lib/permisos'
import { requireSupabase } from '../lib/supabase'
import {
  FORMAS_PAGO,
  etiquetaCuotas,
  formatoFechaVenta,
  listarVentasExport,
  listarVentasPaginado,
  resumenVentasHoy,
  type VentaFila,
} from '../lib/ventas'
import { theme } from '../theme'

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
  const [hoy, setHoy] = useState({ cantidad: 0, total: 0 })
  const inicial = rangoMes()
  const [desde, setDesde] = useState(inicial.desde)
  const [hasta, setHasta] = useState(inicial.hasta)
  const [productoId, setProductoId] = useState('')
  const [forma, setForma] = useState('')
  const [cliente, setCliente] = useState('')
  const [numeroVenta, setNumeroVenta] = useState('')
  const [menu, setMenu] = useState<'pago' | 'cliente' | null>(null)
  const [importar, setImportar] = useState(false)
  const [mostrarAnuladas, setMostrarAnuladas] = useState(false)
  const [anular, setAnular] = useState<VentaFila | null>(null)
  const [menuExportar, setMenuExportar] = useState(false)
  const [exportando, setExportando] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
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
        numeroVenta,
        mostrarAnuladas,
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
  }, [pagina, desde, hasta, forma, cliente, productoId, numeroVenta, mostrarAnuladas])

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

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!exportRef.current?.contains(ev.target as Node)) setMenuExportar(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (!perfil) return null

  const puedeAnular = perfil.usuario.rol === 'dueno'
  const nombreEmpresa = perfil.empresa.nombre

  const filtrosExport = {
    desde,
    hasta,
    forma,
    cliente,
    productoId,
    numeroVenta,
    mostrarAnuladas,
  }

  async function onExportar(tipo: 'xlsx' | 'pdf') {
    setError(null)
    setMenuExportar(false)
    if (total > 50000) {
      setError(
        `Hay ${total} ventas en este período.\nAplicá un filtro de fecha más acotado para exportar.`,
      )
      return
    }
    setExportando(true)
    const { filas: data, error: fallo } = await listarVentasExport(requireSupabase(), filtrosExport)
    if (fallo) {
      setExportando(false)
      setError(fallo)
      return
    }
    try {
      if (tipo === 'xlsx') {
        await exportarVentasExcel({ empresa: nombreEmpresa, ventas: data })
      } else {
        await exportarVentasPdf({
          empresa: nombreEmpresa,
          desde,
          hasta,
          ventas: data,
        })
      }
    } catch {
      setError('No se pudo generar el archivo')
    }
    setExportando(false)
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

        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SearchField
              value={numeroVenta}
              onChange={(v) => {
                setPagina(1)
                setNumeroVenta(v)
              }}
              placeholder="Buscar por N° venta"
            />
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="relative" ref={exportRef}>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-[rgba(99,102,241,0.45)] px-4 text-sm font-semibold text-[#A5B4FC] hover:bg-white/5 disabled:opacity-50"
                  type="button"
                  disabled={exportando}
                  onClick={() => setMenuExportar((v) => !v)}
                >
                  {exportando ? 'Exportando…' : 'Exportar'}
                </button>
                {menuExportar ? (
                  <div className="dropdown-panel absolute left-0 z-20 overflow-hidden rounded-lg border border-[rgba(99,102,241,0.35)] bg-[#0F1729] shadow-lg md:left-auto md:right-0">
                    <button
                      className="block w-full px-4 py-2.5 text-left text-sm text-[#F1F5F9] hover:bg-white/10"
                      type="button"
                      onClick={() => void onExportar('xlsx')}
                    >
                      Exportar a Excel (.xlsx)
                    </button>
                    <button
                      className="block w-full px-4 py-2.5 text-left text-sm text-[#F1F5F9] hover:bg-white/10"
                      type="button"
                      onClick={() => void onExportar('pdf')}
                    >
                      Exportar a PDF
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="hidden flex-wrap gap-2 md:flex">
                {tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'registrar_ventas') ? (
                  <button
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-[rgba(99,102,241,0.45)] px-4 text-sm font-semibold text-[#A5B4FC] hover:bg-white/5"
                    type="button"
                    onClick={() => setImportar(true)}
                  >
                    Importar Excel
                  </button>
                ) : null}
                <Link className={btnPrimaryDesk} to="/ventas/nueva">
                  Nueva venta
                </Link>
              </div>
            </div>
          </div>
          <FilterCollapse activo={Boolean(productoId) || Boolean(numeroVenta.trim()) || mostrarAnuladas}>
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
            <label className="filter-anuladas">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#6366F1]"
                checked={mostrarAnuladas}
                onChange={(ev) => {
                  setPagina(1)
                  setMostrarAnuladas(ev.target.checked)
                }}
              />
              Mostrar anuladas
            </label>
          </FilterCollapse>
        </div>

        {error && error !== MSG_ERROR_RED ? (
          <p className="mb-6 whitespace-pre-line rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <TableCard>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-left">
            <thead className={theadClass} style={theadStyle}>
              <tr>
                <Th>N° Venta</Th>
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
                  <td className="px-3 py-3 whitespace-nowrap font-semibold text-[#A5B4FC]">
                    {fila.numeroVenta ?? '—'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {formatoFechaVenta(fila.fecha)}
                      {fila.anulada ? (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-[#F87171]">
                          Anulada
                        </span>
                      ) : null}
                    </span>
                  </td>
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
                      {!fila.anulada ? (
                        <IconBtn label="Anular venta" hoverOnly onClick={() => setAnular(fila)}>
                          🗑️
                        </IconBtn>
                      ) : null}
                    </td>
                  ) : null}
                </Tr>
              ))}
            </tbody>
            ) : null}
          </table>
          </div>
          {!cargando && error !== MSG_ERROR_RED ? (
            <MobileCards>
              {filas.map((fila) => (
                <ListCard key={fila.id}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {fila.numeroVenta ? `${fila.numeroVenta} · ` : ''}
                      {formatoFechaVenta(fila.fecha)}
                      {fila.anulada ? ' · Anulada' : ''}
                    </p>
                    <BadgePago forma={fila.forma_pago} />
                  </div>
                  <p className="mt-1 text-sm font-medium">{fila.productos || '—'}</p>
                  <p className="mt-1 font-bold text-[#4ADE80]">{formatoARS(fila.total)}</p>
                  {puedeAnular && !fila.anulada ? (
                    <button
                      className="mt-2 text-xs text-[#F87171]"
                      type="button"
                      onClick={() => setAnular(fila)}
                    >
                      Anular
                    </button>
                  ) : null}
                </ListCard>
              ))}
            </MobileCards>
          ) : null}
          {cargando ? <TableSkeleton /> : null}
          {!cargando && error === MSG_ERROR_RED ? (
            <TableErrorRed onReintentar={() => void cargar()} />
          ) : null}
          {!cargando && filas.length === 0 && !error ? (
            total === 0 ? (
              <EmptyState
                icono="💸"
                titulo="Todavía no hay ventas"
                subtitulo="Registrá tu primera venta para empezar a ver tus métricas"
                accion={
                  perfil.usuario.rol !== 'visor' ? (
                    <Link className={btnPrimary} to="/ventas/nueva">
                      Nueva venta
                    </Link>
                  ) : null
                }
              />
            ) : (
              <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Ninguna venta coincide con los filtros.
              </p>
            )
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
        {importar ? (
          <ImportarVentasModal
            productos={productos}
            onCerrar={() => setImportar(false)}
            onListo={cargar}
          />
        ) : null}
        {anular ? (
          <AnularVentaModal
            venta={anular}
            onCerrar={() => setAnular(null)}
            onOk={() => {
              setAnular(null)
              void cargar()
            }}
          />
        ) : null}
        {tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'registrar_ventas') ? (
          <FabLink to="/ventas/nueva" label="Nueva venta" />
        ) : null}
      </div>
    </div>
  )
}
