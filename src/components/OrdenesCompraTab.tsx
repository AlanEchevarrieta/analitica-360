import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { esSoloLectura } from '../lib/permisos'
import {
  PAGE_COMPRAS,
  PaginacionBar,
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
} from './listado'
import { MSG_ERROR_RED, mensajeCargaTabla } from '../lib/consulta'
import {
  BADGE_ESTADO_OC,
  ESTADOS_OC,
  formatoFechaOc,
  listarOrdenesCompra,
  type EstadoOc,
  type OrdenCompraFila,
} from '../lib/ordenesCompra'
import { formatoARS } from '../lib/productos'
import { etiquetaProveedor, listarProveedoresEmpresa, type ProveedorFila } from '../lib/proveedores'
import { requireSupabase } from '../lib/supabase'

function BadgeEstadoOc({ estado }: { estado: EstadoOc }) {
  const b = BADGE_ESTADO_OC[estado]
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: b.bg, color: b.fg }}
    >
      {b.label}
    </span>
  )
}

export function OrdenesCompraTab() {
  const { perfil } = useAuth()
  const puedeEscribir = !esSoloLectura(perfil)
  const [filas, setFilas] = useState<OrdenCompraFila[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [estado, setEstado] = useState('todos')
  const [proveedorId, setProveedorId] = useState('')
  const [proveedores, setProveedores] = useState<ProveedorFila[]>([])
  const [pagina, setPagina] = useState(1)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { filas: data, error: fallo } = await listarOrdenesCompra(requireSupabase(), {
      estado,
      proveedorId,
    })
    setCargando(false)
    if (fallo) {
      const msg = mensajeCargaTabla(fallo)
      setError(msg === MSG_ERROR_RED ? MSG_ERROR_RED : fallo)
      return
    }
    setError(null)
    setFilas(data)
  }, [estado, proveedorId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    void listarProveedoresEmpresa(requireSupabase()).then((res) => {
      if (!res.error) setProveedores(res.filas)
    })
  }, [])

  const from = (pagina - 1) * PAGE_COMPRAS
  const page = filas.slice(from, from + PAGE_COMPRAS)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Estado
            <select
              className="mt-1 block h-11 min-w-[160px] rounded-md border px-3 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--card-bg)', color: 'var(--text)' }}
              value={estado}
              onChange={(ev) => {
                setPagina(1)
                setEstado(ev.target.value)
              }}
            >
              <option value="todos">Todos</option>
              {ESTADOS_OC.filter((e) => e !== 'recibida_parcial').map((e) => (
                <option key={e} value={e}>
                  {BADGE_ESTADO_OC[e].label}
                </option>
              ))}
              <option value="recibida_parcial">{BADGE_ESTADO_OC.recibida_parcial.label}</option>
            </select>
          </label>
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Proveedor
            <select
              className="mt-1 block h-11 min-w-[180px] rounded-md border px-3 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--card-bg)', color: 'var(--text)' }}
              value={proveedorId}
              onChange={(ev) => {
                setPagina(1)
                setProveedorId(ev.target.value)
              }}
            >
              <option value="">Todos</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {etiquetaProveedor(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {puedeEscribir ? (
          <Link className={btnPrimaryDesk} to="/compras/oc/nueva">
            Nueva OC
          </Link>
        ) : null}
      </div>

      {error && error !== MSG_ERROR_RED ? (
        <p className="mb-6 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}

      <TableCard>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[800px] text-left">
            <thead className={theadClass} style={theadStyle}>
              <tr>
                <Th>N° OC</Th>
                <Th>Proveedor</Th>
                <Th>Estado</Th>
                <Th>Fecha emisión</Th>
                <Th>Entrega estimada</Th>
                <Th>Total</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            {!cargando && error !== MSG_ERROR_RED ? (
              <tbody>
                {page.map((fila, index) => (
                  <Tr key={fila.id} index={index}>
                    <td className="px-3 py-3 font-semibold">{fila.numeroOc}</td>
                    <td className="px-3 py-3">{fila.proveedorNombre || '—'}</td>
                    <td className="px-3 py-3">
                      <BadgeEstadoOc estado={fila.estado} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatoFechaOc(fila.fechaEmision)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatoFechaOc(fila.fechaEntregaEstimada)}</td>
                    <td className="px-3 py-3 font-bold text-[#6366F1]">{formatoARS(fila.total)}</td>
                    <td className="px-3 py-3">
                      <Link className="text-sm font-semibold text-[#A5B4FC] hover:underline" to={`/compras/oc/${fila.id}`}>
                        Ver
                      </Link>
                    </td>
                  </Tr>
                ))}
              </tbody>
            ) : null}
          </table>
        </div>
        {!cargando && error !== MSG_ERROR_RED ? (
          <MobileCards>
            {page.map((fila) => (
              <ListCard key={fila.id}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {fila.numeroOc} · {formatoFechaOc(fila.fechaEmision)}
                </p>
                <p className="mt-1 text-sm font-medium">{fila.proveedorNombre || 'Sin proveedor'}</p>
                <div className="mt-1">
                  <BadgeEstadoOc estado={fila.estado} />
                </div>
                <p className="mt-1 font-bold text-[#6366F1]">{formatoARS(fila.total)}</p>
                <Link className="mt-2 inline-block text-xs text-[#A5B4FC]" to={`/compras/oc/${fila.id}`}>
                  Ver ficha
                </Link>
              </ListCard>
            ))}
          </MobileCards>
        ) : null}
        {cargando ? <TableSkeleton /> : null}
        {!cargando && error === MSG_ERROR_RED ? <TableErrorRed onReintentar={() => void cargar()} /> : null}
        {!cargando && filas.length === 0 && !error ? (
          <p className="px-3 py-6 text-center text-sm text-[#94A3B8]">Todavía no hay órdenes de compra.</p>
        ) : null}
      </TableCard>
      {!cargando && error !== MSG_ERROR_RED && filas.length > PAGE_COMPRAS ? (
        <PaginacionBar
          pagina={pagina}
          total={filas.length}
          pageSize={PAGE_COMPRAS}
          onPagina={setPagina}
          entidad="órdenes"
        />
      ) : null}
      {puedeEscribir ? <FabLink to="/compras/oc/nueva" label="Nueva OC" /> : null}
    </div>
  )
}
