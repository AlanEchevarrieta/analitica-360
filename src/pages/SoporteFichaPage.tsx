import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { BadgeEstadoTicket, BadgePrioridadTicket } from '../components/TicketBadges'
import { TicketHilo } from '../components/TicketHilo'
import { PageTitle, btnPrimary, cardShell } from '../components/listado'
import {
  ESTADOS_TICKET,
  avisarRespuestaCliente,
  cambiarEstadoTicket,
  etiquetaCategoria,
  enviarRespuestaTicket,
  formatoFechaTicket,
  marcarTicketVisto,
  obtenerFichaTicket,
  type EstadoTicket,
  type TicketFicha,
} from '../lib/tickets'
import { esAdminEmail } from '../lib/suscripcion'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

export function SoporteFichaPage() {
  const { id } = useParams()
  const { perfil, session } = useAuth()
  const admin = esAdminEmail(session?.user.email ?? perfil?.usuario.email)
  const [ficha, setFicha] = useState<TicketFicha | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [guardandoEstado, setGuardandoEstado] = useState(false)

  const cargar = useCallback(async () => {
    if (!id) return
    const res = await obtenerFichaTicket(requireSupabase(), id)
    setFicha(res.ficha)
    setError(res.error)
    if (res.ficha && !admin) {
      void marcarTicketVisto(requireSupabase(), res.ficha.id)
    }
  }, [id, admin])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    if (!id) return
    const client = requireSupabase()
    const ch = client
      .channel(`ticket-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets', filter: `id=eq.${id}` },
        () => void cargar(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets_respuestas', filter: `ticket_id=eq.${id}` },
        () => void cargar(),
      )
      .subscribe()
    const t = window.setInterval(() => void cargar(), 12000)
    return () => {
      window.clearInterval(t)
      void client.removeChannel(ch)
    }
  }, [id, cargar])

  async function onEnviar(texto: string) {
    if (!ficha) return
    setEnviando(true)
    const fallo = await enviarRespuestaTicket(requireSupabase(), ficha.id, texto)
    setEnviando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    if (admin) {
      void avisarRespuestaCliente({
        email: ficha.usuario_email,
        nombre: ficha.usuario_nombre,
        numero: ficha.numero_ticket,
        ticketId: ficha.id,
      })
    }
    await cargar()
  }

  async function onEstado(estado: EstadoTicket) {
    if (!ficha) return
    setGuardandoEstado(true)
    const fallo = await cambiarEstadoTicket(requireSupabase(), ficha.id, estado)
    setGuardandoEstado(false)
    if (fallo) setError(fallo)
    else await cargar()
  }

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
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <AppNav />
        <PageTitle
          titulo={ficha ? ficha.numero_ticket : 'Ticket'}
          subtitulo={ficha?.asunto}
          accion={
            <Link className="text-sm text-[#A5B4FC] hover:underline" to={admin ? '/admin?tab=soporte' : '/soporte'}>
              {admin ? 'Volver al admin' : 'Volver'}
            </Link>
          }
        />
        {error ? <p className="mb-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        {!ficha && !error ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</p> : null}
        {ficha ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 p-4" style={cardShell}>
              <BadgeEstadoTicket estado={ficha.estado} />
              <BadgePrioridadTicket prioridad={ficha.prioridad} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {etiquetaCategoria(ficha.categoria)} · {formatoFechaTicket(ficha.created_at)}
              </span>
              {admin && ficha.empresa_nombre ? (
                <span className="text-xs font-medium text-[#A5B4FC]">{ficha.empresa_nombre}</span>
              ) : null}
            </div>

            {admin ? (
              <div className="flex flex-wrap items-end gap-3 p-4" style={cardShell}>
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Estado
                  <select
                    className="mt-1 block h-10 rounded-md border border-[#E2E8F0] bg-white px-2 text-sm text-[#1A2F4A]"
                    value={ficha.estado}
                    disabled={guardandoEstado}
                    onChange={(ev) => void onEstado(ev.target.value as EstadoTicket)}
                  >
                    {ESTADOS_TICKET.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                </label>
                {ficha.estado !== 'cerrado' ? (
                  <button
                    className={btnPrimary}
                    type="button"
                    disabled={guardandoEstado}
                    onClick={() => void onEstado('cerrado')}
                  >
                    Cerrar ticket
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="p-4" style={cardShell}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Descripción
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm" style={{ color: 'var(--text)' }}>
                {ficha.descripcion}
              </p>
            </div>

            <TicketHilo
              respuestas={ficha.respuestas}
              cerrado={ficha.estado === 'cerrado'}
              enviando={enviando}
              vistaAdmin={admin}
              onEnviar={onEnviar}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
