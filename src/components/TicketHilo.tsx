import { useState, type FormEvent } from 'react'
import { btnPrimary, cardShell } from './listado'
import { formatoFechaTicket, type TicketRespuesta } from '../lib/tickets'

export function TicketHilo({
  respuestas,
  cerrado,
  enviando,
  vistaAdmin,
  onEnviar,
}: {
  respuestas: TicketRespuesta[]
  cerrado: boolean
  enviando: boolean
  vistaAdmin?: boolean
  onEnviar: (texto: string) => Promise<void>
}) {
  const [texto, setTexto] = useState('')

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    const t = texto.trim()
    if (!t) return
    await onEnviar(t)
    setTexto('')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {respuestas.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Todavía no hay respuestas.
          </p>
        ) : (
          respuestas.map((r) => (
            <div key={r.id} className={`flex ${r.es_admin ? 'justify-start' : 'justify-end'}`}>
              <div
                className="max-w-[85%] rounded-xl px-3 py-2"
                style={{
                  background: r.es_admin ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}
              >
                {r.es_admin ? (
                  <p className="mb-1 text-[11px] font-semibold text-[#A5B4FC]">Soporte ✓</p>
                ) : (
                  <p className="mb-1 text-[11px] font-semibold text-[#C7D2FE]">{vistaAdmin ? 'Cliente' : 'Vos'}</p>
                )}
                <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text)' }}>
                  {r.contenido}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {formatoFechaTicket(r.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {cerrado ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Este ticket está cerrado. No se pueden enviar más respuestas.
        </p>
      ) : (
        <form className="space-y-3" style={cardShell} onSubmit={(ev) => void submit(ev)}>
          <div className="p-4">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Respuesta
              <textarea
                className="mt-1.5 min-h-[96px] w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 py-2 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white"
                value={texto}
                onChange={(ev) => setTexto(ev.target.value)}
                placeholder="Escribí tu mensaje…"
              />
            </label>
            <button className={`${btnPrimary} mt-3`} disabled={enviando || !texto.trim()} type="submit">
              {enviando ? 'Enviando…' : 'Enviar respuesta'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
