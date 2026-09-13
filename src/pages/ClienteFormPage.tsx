import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import {
  COLOR_ETIQUETA,
  ETIQUETAS_CLIENTE,
  crearCliente,
  cumpleanosAFecha,
} from '../lib/clientes'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

const inputClass =
  'mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]'

export function ClienteFormPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [mes, setMes] = useState('')
  const [dia, setDia] = useState('')
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const meses = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        v: String(i + 1),
        l: new Date(2000, i, 1).toLocaleDateString('es-AR', { month: 'long' }),
      })),
    [],
  )

  function toggleEtiqueta(e: string) {
    setEtiquetas((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]))
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setError(null)
    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setEnviando(true)
    const { id, error: fallo } = await crearCliente(requireSupabase(), {
      nombre: nombre.trim(),
      telefono,
      email,
      cumpleanos: cumpleanosAFecha(mes, dia),
      notasLibres: notas,
      etiquetas,
    })
    setEnviando(false)
    if (fallo || !id) {
      setError(fallo || 'No se pudo crear el cliente. Corré supabase/017_clientes.sql.')
      return
    }
    navigate(`/clientes/${id}`, { replace: true })
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
      <div className="relative z-10 mx-auto max-w-[440px] px-4 py-8">
        <AppNav />
        <form className="rounded-lg bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]" onSubmit={(e) => void onSubmit(e)}>
          <h1 className="text-xl font-bold text-[#1A2F4A]">Nuevo cliente</h1>
          <label className="mt-5 block text-sm font-medium text-[#4A5568]">
            Nombre o apodo
            <input className={inputClass} value={nombre} onChange={(ev) => setNombre(ev.target.value)} />
          </label>
          <label className="mt-4 block text-sm font-medium text-[#4A5568]">
            Teléfono / WhatsApp
            <input className={inputClass} value={telefono} onChange={(ev) => setTelefono(ev.target.value)} />
          </label>
          <label className="mt-4 block text-sm font-medium text-[#4A5568]">
            Email
            <input className={inputClass} type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} />
          </label>
          <p className="mt-4 text-sm font-medium text-[#4A5568]">Cumpleaños (día y mes)</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <select className={inputClass} value={dia} onChange={(ev) => setDia(ev.target.value)}>
              <option value="">Día</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {i + 1}
                </option>
              ))}
            </select>
            <select className={inputClass} value={mes} onChange={(ev) => setMes(ev.target.value)}>
              <option value="">Mes</option>
              {meses.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.l}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-4 text-sm font-medium text-[#4A5568]">Etiquetas</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ETIQUETAS_CLIENTE.map((e) => {
              const on = etiquetas.includes(e)
              const c = COLOR_ETIQUETA[e]
              return (
                <button
                  key={e}
                  type="button"
                  className={`etiqueta-cliente rounded-full px-3 py-1 text-xs font-semibold${on ? ' etiqueta-on' : ''}`}
                  data-etiqueta={e}
                  style={{
                    background: on ? c.bg : '#EEF2F6',
                    color: on ? c.fg : '#4A5568',
                    boxShadow: on ? `inset 0 0 0 1px ${c.fg}` : undefined,
                  }}
                  onClick={() => toggleEtiqueta(e)}
                >
                  {e}
                </button>
              )
            })}
          </div>
          <label className="mt-4 block text-sm font-medium text-[#4A5568]">
            Notas libres
            <textarea
              className="mt-1.5 min-h-[88px] w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 py-2 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1]"
              value={notas}
              onChange={(ev) => setNotas(ev.target.value)}
            />
          </label>
          {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button
            className="mt-6 h-11 w-full rounded-lg bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
            disabled={enviando}
            type="submit"
          >
            {enviando ? 'GUARDANDO…' : 'Guardar cliente'}
          </button>
          <Link className="mt-4 block text-center text-sm font-medium text-[#6366F1]" to="/clientes">
            Volver al listado
          </Link>
        </form>
      </div>
    </div>
  )
}
