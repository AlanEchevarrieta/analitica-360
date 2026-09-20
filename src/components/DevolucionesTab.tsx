import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  ListCard,
  MobileCards,
  PageTitle,
  TableCard,
  TableErrorRed,
  TableSkeleton,
  Th,
  Tr,
  btnPrimary,
  FabLink,
  theadClass,
  theadStyle,
} from './listado'
import { MSG_ERROR_RED, mensajeCargaTabla } from '../lib/consulta'
import {
  etiquetaEstadoDevolucion,
  etiquetaTipoDevolucion,
  estiloEstadoDevolucion,
  estiloTipoDevolucion,
  formatoFechaDevolucion,
  listarDevoluciones,
  type DevolucionFila,
} from '../lib/devoluciones'
import { requireSupabase } from '../lib/supabase'

function Badge({ texto, fg, bg }: { texto: string; fg: string; bg: string }) {
  return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: fg, background: bg }}>
      {texto}
    </span>
  )
}

export function DevolucionesTab() {
  const [filas, setFilas] = useState<DevolucionFila[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    const { filas: data, error: fallo } = await listarDevoluciones(requireSupabase(), {
      tipo,
      estado,
      desde,
      hasta,
    })
    setCargando(false)
    if (fallo) {
      const msg = mensajeCargaTabla(fallo)
      setError(msg ?? fallo)
      return
    }
    setError(null)
    setFilas(data)
  }, [tipo, estado, desde, hasta])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <>
      <PageTitle
        titulo="Cambios y Devoluciones"
        subtitulo={`${filas.length} ${filas.length === 1 ? 'registro' : 'registros'}`}
        accion={
          <Link className={btnPrimary} to="/ventas/devoluciones/nueva">
            Nueva devolución / cambio
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          className="h-11 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#1A2F4A]"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          <option value="devolucion">Devolución</option>
          <option value="cambio">Cambio</option>
        </select>
        <select
          className="h-11 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#1A2F4A]"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="procesado">Procesado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <input
          className="h-11 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#1A2F4A]"
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
        <input
          className="h-11 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#1A2F4A]"
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
        />
      </div>
      {error && error !== MSG_ERROR_RED ? (
        <p className="mb-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}
      <TableCard>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left">
            <thead className={theadClass} style={theadStyle}>
              <tr>
                <Th>N°</Th>
                <Th>Tipo</Th>
                <Th>Fecha</Th>
                <Th>Venta original</Th>
                <Th>Productos</Th>
                <Th>Estado</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            {!cargando && error !== MSG_ERROR_RED ? (
              <tbody>
                {filas.map((f, i) => {
                  const t = estiloTipoDevolucion(f.tipo)
                  const e = estiloEstadoDevolucion(f.estado)
                  return (
                    <Tr key={f.id} index={i}>
                      <td className="px-3 py-3 font-semibold">{f.numero ?? '—'}</td>
                      <td className="px-3 py-3">
                        <Badge texto={etiquetaTipoDevolucion(f.tipo)} fg={t.fg} bg={t.bg} />
                      </td>
                      <td className="px-3 py-3">{formatoFechaDevolucion(f.fecha)}</td>
                      <td className="px-3 py-3">{f.ventaLabel ?? '—'}</td>
                      <td className="max-w-[220px] truncate px-3 py-3" title={f.productos}>
                        {f.productos}
                      </td>
                      <td className="px-3 py-3">
                        <Badge texto={etiquetaEstadoDevolucion(f.estado)} fg={e.fg} bg={e.bg} />
                      </td>
                      <td className="px-3 py-3">
                        <Link className="text-sm font-semibold text-[#A5B4FC] hover:underline" to={`/ventas/devoluciones/${f.id}`}>
                          Ver
                        </Link>
                      </td>
                    </Tr>
                  )
                })}
              </tbody>
            ) : null}
          </table>
        </div>
        {!cargando && error !== MSG_ERROR_RED ? (
          <MobileCards>
            {filas.map((f) => {
              const t = estiloTipoDevolucion(f.tipo)
              return (
                <ListCard key={f.id} to={`/ventas/devoluciones/${f.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">#{f.numero ?? '—'}</p>
                    <Badge texto={etiquetaTipoDevolucion(f.tipo)} fg={t.fg} bg={t.bg} />
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatoFechaDevolucion(f.fecha)} · {f.productos}
                  </p>
                </ListCard>
              )
            })}
          </MobileCards>
        ) : null}
        {cargando ? <TableSkeleton /> : null}
        {!cargando && error === MSG_ERROR_RED ? <TableErrorRed onReintentar={() => void cargar()} /> : null}
        {!cargando && filas.length === 0 && !error ? (
          <EmptyState
            icono="🔄"
            titulo="Todavía no hay cambios ni devoluciones"
            subtitulo="Registrá el caso de Sergio u otro cambio para actualizar el stock"
            accion={
              <Link className={btnPrimary} to="/ventas/devoluciones/nueva">
                Nueva devolución / cambio
              </Link>
            }
          />
        ) : null}
      </TableCard>
      <FabLink to="/ventas/devoluciones/nueva" label="Nueva devolución" />
    </>
  )
}
