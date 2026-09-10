import type { EstadoTicket, PrioridadTicket } from '../lib/tickets'
import { etiquetaEstado, etiquetaPrioridad } from '../lib/tickets'

const ESTADO_STYLE: Record<EstadoTicket, { bg: string; fg: string }> = {
  abierto: { bg: 'rgba(99,102,241,0.18)', fg: '#6366F1' },
  en_proceso: { bg: 'rgba(252,211,77,0.18)', fg: '#FCD34D' },
  resuelto: { bg: 'rgba(74,222,128,0.16)', fg: '#4ADE80' },
  cerrado: { bg: 'rgba(148,163,184,0.18)', fg: '#94A3B8' },
}

const PRIORIDAD_STYLE: Record<PrioridadTicket, { bg: string; fg: string }> = {
  baja: { bg: 'rgba(148,163,184,0.18)', fg: '#94A3B8' },
  media: { bg: 'rgba(99,102,241,0.18)', fg: '#6366F1' },
  alta: { bg: 'rgba(245,158,11,0.18)', fg: '#F59E0B' },
  urgente: { bg: 'rgba(248,113,113,0.18)', fg: '#F87171' },
}

function Badge({ bg, fg, children }: { bg: string; fg: string; children: string }) {
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-[2px] text-xs font-medium"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  )
}

export function BadgeEstadoTicket({ estado }: { estado: EstadoTicket }) {
  const s = ESTADO_STYLE[estado] ?? ESTADO_STYLE.abierto
  return <Badge bg={s.bg} fg={s.fg}>{etiquetaEstado(estado)}</Badge>
}

export function BadgePrioridadTicket({ prioridad }: { prioridad: PrioridadTicket }) {
  const s = PRIORIDAD_STYLE[prioridad] ?? PRIORIDAD_STYLE.media
  return <Badge bg={s.bg} fg={s.fg}>{etiquetaPrioridad(prioridad)}</Badge>
}
