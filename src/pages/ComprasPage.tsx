import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { AnularCompraModal } from '../components/AnularCompraModal'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  PAGE_COMPRAS,
  PageTitle,
  PaginacionBar,
  SearchField,
  TableCard,
  TableErrorRed,
  TableSkeleton,
  Th,
  Tr,
  btnPrimaryDesk,
  FabLink,
  FilterCollapse,
  IconBtn,
  ListCard,
  MobileCards,
  theadClass,
  theadStyle,
} from '../components/listado'
import { ImportarComprasModal } from '../components/ImportarComprasModal'
import { formatoFechaCompra, listarComprasPaginado, type CompraFila } from '../lib/compras'
import { MSG_ERROR_RED, mensajeCargaTabla } from '../lib/consulta'
import { formatoARS, listarProductosNombres } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

export function ComprasPage() {
  const { perfil } = useAuth()
  const [filas, setFilas] = useState<CompraFila[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [importar, setImportar] = useState(false)
  const [productos, setProductos] = useState<{ id: string; nombre: string }[]>([])
  const [mostrarAnuladas, setMostrarAnuladas] = useState(false)
  const [anular, setAnular] = useState<CompraFila | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { filas: data, total: n, error: listError } = await listarComprasPaginado(requireSupabase(), {
      pagina,
      pageSize: PAGE_COMPRAS,
      proveedor: busqueda,
      mostrarAnuladas,
    })
    setCargando(false)
    if (listError) {
      const msg = mensajeCargaTabla(listError)
      if (msg) setError(msg)
      return
    }
    setError(null)
    setFilas(data)
    setTotal(n)
  }, [pagina, busqueda, mostrarAnuladas])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    void listarProductosNombres(requireSupabase()).then((res) => {
      if (!res.error) setProductos(res.filas)
    })
  }, [])

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
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 text-white">
        <AppNav />
        <PageTitle
          titulo="Compras"
          subtitulo={`${total} ${total === 1 ? 'compra registrada' : 'compras registradas'}`}
        />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <SearchField
            value={busqueda}
            onChange={(v) => {
              setPagina(1)
              setBusqueda(v)
            }}
            placeholder="Buscar por proveedor"
          />
          <FilterCollapse activo={mostrarAnuladas}>
            <label className="filter-field flex cursor-pointer items-end gap-2 pb-2 text-sm text-[#A5B4FC]">
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
          <div className="hidden flex-wrap gap-2 md:flex">
            {perfil.usuario.rol !== 'visor' ? (
              <button
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[rgba(99,102,241,0.45)] px-4 text-sm font-semibold text-[#A5B4FC] hover:bg-white/5"
                type="button"
                onClick={() => setImportar(true)}
              >
                Importar Excel
              </button>
            ) : null}
            <Link className={btnPrimaryDesk} to="/compras/nueva">
              Nueva compra
            </Link>
          </div>
        </div>

        {error && error !== MSG_ERROR_RED ? (
          <p className="mb-6 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}

        <TableCard>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] text-left">
            <thead className={theadClass} style={theadStyle}>
              <tr>
                <Th>Fecha</Th>
                <Th>Proveedor</Th>
                <Th>Productos</Th>
                <Th>Total</Th>
                <Th>Notas</Th>
                {perfil.usuario.rol === 'dueno' ? <Th /> : null}
              </tr>
            </thead>
            {!cargando && error !== MSG_ERROR_RED ? (
            <tbody>
              {filas.map((fila, index) => (
                <Tr key={fila.id} index={index}>
                  <td className="px-3 py-3 whitespace-nowrap text-[#E2E8F0]">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {formatoFechaCompra(fila.fecha)}
                      {fila.anulada ? (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-[#F87171]">
                          Anulada
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {fila.proveedor ? (
                      <span>🏭 {fila.proveedor}</span>
                    ) : (
                      <span className="text-[#94A3B8]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">{fila.productos || '—'}</td>
                  <td className="px-3 py-3 font-bold text-[#6366F1]">{formatoARS(fila.total)}</td>
                  <td className="px-3 py-3 text-[#94A3B8]">{fila.notas ?? '—'}</td>
                  {perfil.usuario.rol === 'dueno' ? (
                    <td className="px-3 py-3">
                      {!fila.anulada ? (
                        <IconBtn label="Anular compra" hoverOnly onClick={() => setAnular(fila)}>
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
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatoFechaCompra(fila.fecha)}
                    {fila.anulada ? ' · Anulada' : ''}
                  </p>
                  <p className="mt-1 text-sm font-medium">{fila.proveedor || 'Sin proveedor'}</p>
                  <p className="mt-1 font-bold text-[#6366F1]">{formatoARS(fila.total)}</p>
                  {perfil.usuario.rol === 'dueno' && !fila.anulada ? (
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
            <p className="px-3 py-6 text-center text-sm text-[#94A3B8]">
              {total === 0 ? 'Todavía no hay compras.' : 'Ningún proveedor coincide con la búsqueda.'}
            </p>
          ) : null}
        </TableCard>
        {!cargando && error !== MSG_ERROR_RED ? (
        <PaginacionBar
          pagina={pagina}
          total={total}
          pageSize={PAGE_COMPRAS}
          onPagina={setPagina}
          entidad="compras"
        />
        ) : null}
        {perfil.usuario.rol !== 'visor' ? <FabLink to="/compras/nueva" label="Nueva compra" /> : null}
        {importar ? (
          <ImportarComprasModal
            productos={productos}
            onCerrar={() => setImportar(false)}
            onListo={cargar}
          />
        ) : null}
        {anular ? (
          <AnularCompraModal
            compra={anular}
            onCerrar={() => setAnular(null)}
            onOk={() => {
              setAnular(null)
              void cargar()
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
