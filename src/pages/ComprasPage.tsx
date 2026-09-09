import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
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

  const cargar = useCallback(async () => {
    setCargando(true)
    const { filas: data, total: n, error: listError } = await listarComprasPaginado(requireSupabase(), {
      pagina,
      pageSize: PAGE_COMPRAS,
      proveedor: busqueda,
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
  }, [pagina, busqueda])

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
              </tr>
            </thead>
            {!cargando && error !== MSG_ERROR_RED ? (
            <tbody>
              {filas.map((fila, index) => (
                <Tr key={fila.id} index={index}>
                  <td className="px-3 py-3 whitespace-nowrap text-[#E2E8F0]">{formatoFechaCompra(fila.fecha)}</td>
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
                  </p>
                  <p className="mt-1 text-sm font-medium">{fila.proveedor || 'Sin proveedor'}</p>
                  <p className="mt-1 font-bold text-[#6366F1]">{formatoARS(fila.total)}</p>
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
      </div>
    </div>
  )
}
