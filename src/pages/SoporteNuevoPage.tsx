import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { PageTitle, btnPrimary, cardShell } from '../components/listado'
import { mostrarToast } from '../lib/consulta'
import {
  CATEGORIAS_TICKET,
  PRIORIDADES_TICKET,
  crearTicket,
  type CategoriaTicket,
  type PrioridadTicket,
} from '../lib/tickets'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

const inputClass =
  'mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]'

const areaClass =
  'mt-1.5 min-h-[140px] w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 py-2 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]'

export function SoporteNuevoPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [asunto, setAsunto] = useState('')
  const [categoria, setCategoria] = useState<CategoriaTicket>('consulta')
  const [prioridad, setPrioridad] = useState<PrioridadTicket>('media')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!perfil) return
    setError(null)
    if (descripcion.trim().length < 20) {
      setError('La descripción debe tener al menos 20 caracteres.')
      return
    }
    setEnviando(true)
    const { ticket, error: fallo } = await crearTicket(requireSupabase(), {
      asunto,
      descripcion,
      categoria,
      prioridad,
      empresaNombre: perfil.empresa.nombre,
    })
    setEnviando(false)
    if (fallo || !ticket) {
      setError(fallo || 'No se pudo enviar el ticket.')
      return
    }
    const msg = `✅ Tu ticket ${ticket.numero_ticket} fue recibido. Te respondemos en 24 horas hábiles.`
    mostrarToast(msg)
    navigate('/soporte', { replace: true, state: { creado: ticket.numero_ticket } })
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
      <div className="relative z-10 mx-auto max-w-xl px-4 py-8">
        <AppNav />
        <PageTitle
          titulo="Nuevo ticket"
          subtitulo="Te respondemos en 24 horas hábiles"
          accion={
            <Link className="text-sm text-[#A5B4FC] hover:underline" to="/soporte">
              Volver
            </Link>
          }
        />
        {error ? <p className="mb-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        <form className="p-5" style={cardShell} onSubmit={(ev) => void onSubmit(ev)}>
          <label className="block text-sm font-medium text-[#4A5568]">
            Asunto
            <input
              className={inputClass}
              required
              value={asunto}
              onChange={(ev) => setAsunto(ev.target.value)}
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-[#4A5568]">
            Categoría
            <select className={inputClass} value={categoria} onChange={(ev) => setCategoria(ev.target.value as CategoriaTicket)}>
              {CATEGORIAS_TICKET.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm font-medium text-[#4A5568]">
            Prioridad
            <select className={inputClass} value={prioridad} onChange={(ev) => setPrioridad(ev.target.value as PrioridadTicket)}>
              {PRIORIDADES_TICKET.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm font-medium text-[#4A5568]">
            Descripción
            <textarea
              className={areaClass}
              value={descripcion}
              onChange={(ev) => setDescripcion(ev.target.value)}
              minLength={20}
              required
            />
          </label>
          <p className="mt-1 text-xs text-[#94A3B8]">{descripcion.trim().length}/20 mínimo</p>
          <button className={`${btnPrimary} mt-5 w-full`} disabled={enviando} type="submit">
            {enviando ? 'Enviando…' : 'Enviar ticket'}
          </button>
        </form>
      </div>
    </div>
  )
}
