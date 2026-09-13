import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  PAGE_PEDIDOS,
  PageTitle,
  PaginacionBar,
  TableCard,
  TableErrorRed,
  TableSkeleton,
  Th,
  Tr,
  btnPrimaryDesk,
  FabLink,
  FilterCollapse,
  ListCard,
  MobileCards,
  EmptyState,
  theadClass,
  theadStyle,
} from '../components/listado'
import { MSG_ERROR_RED, mensajeCargaTabla } from '../lib/consulta'
import {
  contarPedidosNuevos,
  estiloEstadoPedido,
  etiquetaEstadoPedido,
  etiquetaOrigenPedido,
  formatoFechaPedido,
  listarPedidosPaginado,
  ESTADOS_PEDIDO,
  type EstadoPedido,
  type OrigenPedido,
  type PedidoFila,
} from '../lib/pedidos'
import { formatoARS } from '../lib/productos'
import { tienePermiso } from '../lib/permisos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

function BadgeEstado({ estado }: { estado: EstadoPedido }) {
  const s = estiloEstadoPedido(estado)
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-[2px] text-xs font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {etiquetaEstadoPedido(estado)}
    </span>
  )
}

export function PedidosPage() {
  const { perfil } = useAuth()
  const [filas, setFilas] = useState<PedidoFila[]>([])
  const [total, setTotal] = useState(0)
  const [nuevos, setNuevos] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [estado, setEstado] = useState<EstadoPedido | ''>('')
  const [origen, setOrigen] = useState<OrigenPedido | ''>('')

  const cargar = useCallback(async () => {
    setCargando(true)
    const client = requireSupabase()
    const [{ filas: data, total: n, error: listError }, nNuevos] = await Promise.all([
      listarPedidosPaginado(client, { pagina, pageSize: PAGE_PEDIDOS, estado, origen }),
      contarPedidosNuevos(client),
    ])
    setCargando(false)
    setNuevos(nNuevos)
    if (listError) {
      const msg = mensajeCargaTabla(listError)
      if (msg) setError(msg === MSG_ERROR_RED ? MSG_ERROR_RED : listError)
      return
    }
    setError(null)
    setFilas(data)
    setTotal(n)
  }, [pagina, estado, origen])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const subtitulo = useMemo(() => {
    if (nuevos <= 0) return `${total} ${total === 1 ? 'pedido' : 'pedidos'}`
    return `${total} ${total === 1 ? 'pedido' : 'pedidos'} · ${nuevos} ${nuevos === 1 ? 'nuevo' : 'nuevos'} sin atender`
  }, [total, nuevos])

  if (!perfil) return null
  const puedeCrear = tienePermiso(perfil.usuario.rol, perfil.usuario.permisos, 'registrar_ventas')

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
        <PageTitle
          titulo="Pedidos"
          subtitulo={subtitulo}
          accion={
            puedeCrear ? (
              <Link className={`${btnPrimaryDesk} relative`} to="/pedidos/nueva">
                Nuevo pedido
                {nuevos > 0 ? (
                  <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#DC2626] px-1.5 text-[11px] font-bold text-white">
                    {nuevos > 99 ? '99+' : nuevos}
                  </span>
                ) : null}
              </Link>
            ) : undefined
          }
        />

        <div className="mb-6">
          <FilterCollapse activo={Boolean(estado) || Boolean(origen)}>
            <div className="filter-field">
              <label htmlFor="pedido-estado">Estado</label>
              <select
                id="pedido-estado"
                className="filter-control"
                value={estado}
                onChange={(ev) => {
                  setPagina(1)
                  setEstado(ev.target.value as EstadoPedido | '')
                }}
              >
                <option value="">Todos</option>
                {ESTADOS_PEDIDO.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.id === 'listo_despacho' ? 'Listo' : e.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="pedido-origen">Origen</label>
              <select
                id="pedido-origen"
                className="filter-control"
                value={origen}
                onChange={(ev) => {
                  setPagina(1)
                  setOrigen(ev.target.value as OrigenPedido | '')
                }}
              >
                <option value="">Todos</option>
                <option value="manual">Manual</option>
                <option value="tienda_online">Tienda online</option>
              </select>
            </div>
          </FilterCollapse>
        </div>

        {error && error === MSG_ERROR_RED ? <TableErrorRed onReintentar={() => void cargar()} /> : null}
        {error && error !== MSG_ERROR_RED ? (
          <p className="mb-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}
        {cargando ? <TableSkeleton filas={6} /> : null}

        {!cargando && !error && filas.length === 0 ? (
          <EmptyState
            icono="📦"
            titulo="Todavía no hay pedidos"
            subtitulo="Creá un pedido manual o esperá los que lleguen de la tienda."
            accion={
              puedeCrear ? (
                <Link className={btnPrimaryDesk.replace('hidden md:inline-flex', 'inline-flex')} to="/pedidos/nueva">
                  Nuevo pedido
                </Link>
              ) : undefined
            }
          />
        ) : null}

        {!cargando && filas.length > 0 ? (
          <>
            <TableCard>
              <table className="w-full min-w-[860px] text-left">
                <thead className={theadClass} style={theadStyle}>
                  <tr>
                    <Th>N° Pedido</Th>
                    <Th>Cliente</Th>
                    <Th>Origen</Th>
                    <Th>Estado</Th>
                    <Th>Total</Th>
                    <Th>Fecha</Th>
                    <Th>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila, i) => (
                    <Tr key={fila.id} index={i}>
                      <td className="px-3 py-2.5 text-sm font-semibold text-[#F1F5F9]">{fila.numeroPedido}</td>
                      <td className="px-3 py-2.5 text-sm text-[#CBD5E1]">{fila.clienteNombre || '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-[#94A3B8]">{etiquetaOrigenPedido(fila.origen)}</td>
                      <td className="px-3 py-2.5">
                        <BadgeEstado estado={fila.estado} />
                      </td>
                      <td className="px-3 py-2.5 text-sm text-[#F1F5F9]">{formatoARS(fila.total)}</td>
                      <td className="px-3 py-2.5 text-sm text-[#94A3B8]">{formatoFechaPedido(fila.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <Link className="text-sm font-semibold text-[#A5B4FC] hover:underline" to={`/pedidos/${fila.id}`}>
                          Ver
                        </Link>
                      </td>
                    </Tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
            <MobileCards>
              {filas.map((fila) => (
                <ListCard key={fila.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#F1F5F9]">{fila.numeroPedido}</p>
                      <p className="mt-0.5 text-xs text-[#94A3B8]">{fila.clienteNombre || 'Sin cliente'}</p>
                    </div>
                    <BadgeEstado estado={fila.estado} />
                  </div>
                  <p className="mt-2 text-sm text-[#F1F5F9]">{formatoARS(fila.total)}</p>
                  <p className="mt-1 text-xs text-[#94A3B8]">
                    {etiquetaOrigenPedido(fila.origen)} · {formatoFechaPedido(fila.createdAt)}
                  </p>
                  <Link className="mt-3 inline-block text-sm font-semibold text-[#A5B4FC]" to={`/pedidos/${fila.id}`}>
                    Ver pedido
                  </Link>
                </ListCard>
              ))}
            </MobileCards>
            <PaginacionBar
              pagina={pagina}
              total={total}
              pageSize={PAGE_PEDIDOS}
              onPagina={setPagina}
              entidad="pedidos"
            />
          </>
        ) : null}

        {puedeCrear ? <FabLink to="/pedidos/nueva" label="Nuevo pedido" /> : null}
      </div>
    </div>
  )
}
