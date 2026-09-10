import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { BadgeEstadoTicket, BadgePrioridadTicket } from '../components/TicketBadges'
import {
  FabLink,
  ListCard,
  MobileCards,
  PageTitle,
  TableCard,
  TableErrorRed,
  TableSkeleton,
  Th,
  Tr,
  btnPrimaryDesk,
  theadClass,
  theadStyle,
} from '../components/listado'
import { MSG_ERROR_RED, mensajeCargaTabla } from '../lib/consulta'
import {
  etiquetaCategoria,
  formatoFechaTicket,
  listarTicketsEmpresa,
  type TicketFila,
} from '../lib/tickets'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

export function SoportePage() {
  const { perfil } = useAuth()
  const location = useLocation()
  const [filas, setFilas] = useState<TicketFila[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const creado = (location.state as { creado?: string } | null)?.creado

  const cargar = useCallback(async () => {
    setCargando(true)
    const res = await listarTicketsEmpresa(requireSupabase())
    setFilas(res.filas)
    setError(mensajeCargaTabla(res.error))
    setCargando(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

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
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <AppNav />
        <PageTitle
          titulo="Soporte"
          subtitulo={`${filas.length} ${filas.length === 1 ? 'ticket' : 'tickets'}`}
          accion={
            <Link className={btnPrimaryDesk} to="/soporte/nuevo">
              Nuevo ticket
            </Link>
          }
        />

        {creado ? (
          <p className="mb-4 rounded-lg px-3 py-3 text-sm" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ADE80' }}>
            ✅ Tu ticket {creado} fue recibido. Te respondemos en 24 horas hábiles.
          </p>
        ) : null}

        {error && error !== MSG_ERROR_RED ? (
          <p className="mb-6 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}

        <TableCard>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-left">
              <thead className={theadClass} style={theadStyle}>
                <tr>
                  <Th>N°</Th>
                  <Th>Asunto</Th>
                  <Th>Categoría</Th>
                  <Th>Prioridad</Th>
                  <Th>Estado</Th>
                  <Th>Fecha</Th>
                </tr>
              </thead>
              {!cargando && error !== MSG_ERROR_RED ? (
                <tbody>
                  {filas.map((fila, index) => (
                    <Tr key={fila.id} index={index}>
                      <td className="px-3 py-3 font-medium">
                        <Link className="text-[#A5B4FC] hover:underline" to={`/soporte/${fila.id}`}>
                          {fila.numero_ticket}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <Link className="hover:text-[#6366F1]" to={`/soporte/${fila.id}`}>
                          {fila.asunto}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-sm">{etiquetaCategoria(fila.categoria)}</td>
                      <td className="px-3 py-3">
                        <BadgePrioridadTicket prioridad={fila.prioridad} />
                      </td>
                      <td className="px-3 py-3">
                        <BadgeEstadoTicket estado={fila.estado} />
                      </td>
                      <td className="px-3 py-3 text-sm">{formatoFechaTicket(fila.created_at)}</td>
                    </Tr>
                  ))}
                </tbody>
              ) : null}
            </table>
          </div>
          {!cargando && error !== MSG_ERROR_RED ? (
            <MobileCards>
              {filas.map((fila) => (
                <ListCard key={fila.id} to={`/soporte/${fila.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{fila.asunto}</p>
                    <BadgeEstadoTicket estado={fila.estado} />
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {fila.numero_ticket} · {etiquetaCategoria(fila.categoria)}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <BadgePrioridadTicket prioridad={fila.prioridad} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatoFechaTicket(fila.created_at)}
                    </span>
                  </div>
                </ListCard>
              ))}
            </MobileCards>
          ) : null}
          {cargando ? <TableSkeleton /> : null}
          {!cargando && error === MSG_ERROR_RED ? <TableErrorRed onReintentar={() => void cargar()} /> : null}
          {!cargando && filas.length === 0 && !error ? (
            <p className="px-3 py-6 text-center text-sm text-[#94A3B8]">Todavía no hay tickets.</p>
          ) : null}
        </TableCard>
        <FabLink to="/soporte/nuevo" label="Nuevo ticket" />
      </div>
    </div>
  )
}
