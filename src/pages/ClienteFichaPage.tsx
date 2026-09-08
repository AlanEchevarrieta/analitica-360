import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { BadgePago, TableCard, Th, Tr, btnPrimary, cardShell, theadClass, theadStyle } from '../components/listado'
import {
  COLOR_ETIQUETA,
  ETIQUETAS_CLIENTE,
  TIPOS_INTERACCION,
  actualizarCliente,
  agregarInteraccion,
  cumpleanosAFecha,
  etiquetaTipo,
  fechaACumple,
  formatoCumple,
  linkWhatsApp,
  obtenerFichaCliente,
  type ClienteFicha,
} from '../lib/clientes'
import { formatoARS } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { formatoFechaVenta } from '../lib/ventas'
import { theme } from '../theme'

const inputDark =
  'mt-1.5 h-10 w-full rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9] outline-none focus:border-[#6366F1]'

const MESES_ES = [
  { v: '1', l: 'Enero' },
  { v: '2', l: 'Febrero' },
  { v: '3', l: 'Marzo' },
  { v: '4', l: 'Abril' },
  { v: '5', l: 'Mayo' },
  { v: '6', l: 'Junio' },
  { v: '7', l: 'Julio' },
  { v: '8', l: 'Agosto' },
  { v: '9', l: 'Septiembre' },
  { v: '10', l: 'Octubre' },
  { v: '11', l: 'Noviembre' },
  { v: '12', l: 'Diciembre' },
] as const

function SelectEstilizado({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: { v: string; l: string }[]
}) {
  const [abierto, setAbierto] = useState(false)
  const [foco, setFoco] = useState(false)
  const caja = useRef<HTMLDivElement | null>(null)
  const etiqueta = options.find((o) => o.v === value)?.l ?? placeholder

  useEffect(() => {
    function afuera(ev: MouseEvent) {
      if (!caja.current?.contains(ev.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', afuera)
    return () => document.removeEventListener('mousedown', afuera)
  }, [])

  return (
    <div className="relative" ref={caja}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left text-sm"
        style={{
          background: '#0F1729',
          border: `1px solid ${foco || abierto ? '#6366F1' : 'rgba(99,102,241,0.3)'}`,
          color: value ? '#F1F5F9' : '#94A3B8',
          borderRadius: 8,
          padding: '10px 14px',
        }}
        onClick={() => setAbierto((v) => !v)}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
      >
        <span className="truncate">{etiqueta}</span>
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="#94A3B8" aria-hidden>
          <path d="M5.3 7.3a1 1 0 011.4 0L10 10.58l3.3-3.3a1 1 0 111.4 1.42l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.42z" />
        </svg>
      </button>
      {abierto ? (
        <ul
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto py-1"
          style={{
            background: '#0F1729',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 8,
          }}
        >
          <li>
            <button
              type="button"
              className="w-full px-3.5 py-2 text-left text-sm text-[#94A3B8] hover:bg-[rgba(99,102,241,0.2)]"
              onClick={() => {
                onChange('')
                setAbierto(false)
              }}
            >
              {placeholder}
            </button>
          </li>
          {options.map((o) => (
            <li key={o.v}>
              <button
                type="button"
                className="w-full px-3.5 py-2 text-left text-sm text-[#F1F5F9] hover:bg-[rgba(99,102,241,0.2)]"
                style={{ background: o.v === value ? 'rgba(99,102,241,0.2)' : undefined }}
                onClick={() => {
                  onChange(o.v)
                  setAbierto(false)
                }}
              >
                {o.l}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function ClienteFichaPage() {
  const { id } = useParams()
  const location = useLocation()
  const { perfil } = useAuth()
  const [ficha, setFicha] = useState<ClienteFicha | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(() => Boolean((location.state as { editar?: boolean } | null)?.editar))
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [mes, setMes] = useState('')
  const [dia, setDia] = useState('')
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [tipoNota, setTipoNota] = useState('nota')
  const [contenido, setContenido] = useState('')
  const [privado, setPrivado] = useState(false)
  const [guardandoNota, setGuardandoNota] = useState(false)

  const diasMes = useMemo(
    () => Array.from({ length: 31 }, (_, i) => ({ v: String(i + 1), l: String(i + 1) })),
    [],
  )

  const aplicarFicha = useCallback((data: ClienteFicha) => {
    setNombre(data.nombre)
    setTelefono(data.telefono ?? '')
    setEmail(data.email ?? '')
    const c = fechaACumple(data.cumpleanos)
    setMes(c.mes)
    setDia(c.dia)
    setEtiquetas(data.etiquetas)
    setNotas(data.notas_libres ?? '')
  }, [])

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    const { ficha: data, error: fallo } = await obtenerFichaCliente(requireSupabase(), id)
    setCargando(false)
    if (fallo || !data) {
      setError(fallo || 'No se encontró el cliente')
      return
    }
    setError(null)
    setFicha(data)
    aplicarFicha(data)
  }, [id, aplicarFicha])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function guardarDatos() {
    if (!id) return
    setError(null)
    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setGuardando(true)
    const fallo = await actualizarCliente(requireSupabase(), id, {
      nombre: nombre.trim(),
      telefono,
      email,
      cumpleanos: cumpleanosAFecha(mes, dia),
      notasLibres: notas,
      etiquetas,
    })
    setGuardando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setEditando(false)
    await cargar()
  }

  async function guardarNota() {
    if (!id) return
    setError(null)
    if (!contenido.trim()) {
      setError('Escribí el contenido de la nota')
      return
    }
    setGuardandoNota(true)
    const fallo = await agregarInteraccion(requireSupabase(), {
      clienteId: id,
      tipo: tipoNota,
      contenido,
      privado,
    })
    setGuardandoNota(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setContenido('')
    setPrivado(false)
    await cargar()
  }

  if (!perfil) return null
  const wa = linkWhatsApp(ficha?.telefono ?? null)
  const cumple = formatoCumple(ficha?.cumpleanos ?? null)

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
        <Link className="mb-4 inline-block text-sm font-medium text-[#A5B4FC]" to="/clientes">
          ← Volver a clientes
        </Link>

        {cargando ? <p className="text-sm text-[#94A3B8]">Cargando…</p> : null}
        {error ? <p className="mb-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}

        {ficha ? (
          <>
            <section className="p-5" style={cardShell}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  {editando ? (
                    <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">Editar datos</p>
                  ) : (
                    <h1 className="text-[28px] font-semibold text-[#F1F5F9]" style={{ fontFamily: theme.fontDisplay }}>
                      {ficha.nombre}
                    </h1>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {editando ? (
                    <>
                      <button
                        className="inline-flex h-10 items-center rounded-lg bg-[#6366F1] px-4 text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
                        type="button"
                        disabled={guardando}
                        onClick={() => void guardarDatos()}
                      >
                        {guardando ? 'GUARDANDO…' : 'Guardar'}
                      </button>
                      <button
                        className="inline-flex h-10 items-center rounded-lg border border-white/20 px-4 text-sm text-[#94A3B8]"
                        type="button"
                        onClick={() => {
                          aplicarFicha(ficha)
                          setEditando(false)
                          setError(null)
                        }}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-[#6366F1]"
                        type="button"
                        style={{ border: '1px solid rgba(99,102,241,0.4)', background: 'transparent' }}
                        onClick={() => setEditando(true)}
                      >
                        ✏️ Editar datos
                      </button>
                      {wa ? (
                        <a
                          className="inline-flex h-10 items-center rounded-lg bg-[#25D366] px-4 text-sm font-semibold text-white"
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                        >
                          WhatsApp
                        </a>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              {editando ? (
                <div className="space-y-3">
                  <label className="block text-sm text-[#94A3B8]">
                    Nombre
                    <input className={inputDark} value={nombre} onChange={(ev) => setNombre(ev.target.value)} />
                  </label>
                  <label className="block text-sm text-[#94A3B8]">
                    Teléfono
                    <input className={inputDark} value={telefono} onChange={(ev) => setTelefono(ev.target.value)} />
                  </label>
                  <label className="block text-sm text-[#94A3B8]">
                    Email
                    <input className={inputDark} value={email} onChange={(ev) => setEmail(ev.target.value)} />
                  </label>
                  <p className="text-sm text-[#94A3B8]">Cumpleaños</p>
                  <div className="flex" style={{ gap: 8 }}>
                    <div style={{ width: '35%' }}>
                      <SelectEstilizado value={dia} onChange={setDia} placeholder="Día" options={diasMes} />
                    </div>
                    <div style={{ width: '60%' }}>
                      <SelectEstilizado
                        value={mes}
                        onChange={setMes}
                        placeholder="Mes"
                        options={MESES_ES.map((m) => ({ v: m.v, l: m.l }))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ETIQUETAS_CLIENTE.map((e) => {
                      const on = etiquetas.includes(e)
                      const c = COLOR_ETIQUETA[e]
                      return (
                        <button
                          key={e}
                          type="button"
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          style={{ background: on ? c.bg : 'rgba(255,255,255,0.06)', color: on ? c.fg : '#94A3B8' }}
                          onClick={() =>
                            setEtiquetas((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]))
                          }
                        >
                          {e}
                        </button>
                      )
                    })}
                  </div>
                  <textarea
                    className="min-h-[72px] w-full rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 py-2 text-sm text-[#F1F5F9]"
                    value={notas}
                    onChange={(ev) => setNotas(ev.target.value)}
                    placeholder="Notas libres"
                  />
                </div>
              ) : (
                <>
                  <p className="text-sm text-[#94A3B8]">
                    {ficha.telefono ?? 'Sin teléfono'}
                    {ficha.email ? ` · ${ficha.email}` : ''}
                    {cumple ? ` · Cumple ${cumple}` : ''}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {ficha.etiquetas.map((e) => {
                      const c = COLOR_ETIQUETA[e] ?? { bg: 'rgba(148,163,184,0.12)', fg: '#94A3B8' }
                      return (
                        <span
                          key={e}
                          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{ background: c.bg, color: c.fg }}
                        >
                          {e}
                        </span>
                      )
                    })}
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-[#94A3B8]">Total gastado</p>
                      <p className="mt-1 text-lg font-bold text-[#4ADE80]">{formatoARS(ficha.stats.total)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#94A3B8]">Compras</p>
                      <p className="mt-1 text-lg font-bold">{ficha.stats.cantidad}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#94A3B8]">Primera compra</p>
                      <p className="mt-1 text-sm">{ficha.stats.primera ? formatoFechaVenta(ficha.stats.primera) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#94A3B8]">Última compra</p>
                      <p className="mt-1 text-sm">{ficha.stats.ultima ? formatoFechaVenta(ficha.stats.ultima) : '—'}</p>
                    </div>
                  </div>
                  {ficha.notas_libres ? <p className="mt-4 text-sm text-[#E2E8F0]">{ficha.notas_libres}</p> : null}
                </>
              )}
            </section>

            <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-[#94A3B8]">Historial de compras</h2>
            <TableCard>
              <table className="w-full min-w-[640px] text-left">
                <thead className={theadClass} style={theadStyle}>
                  <tr>
                    <Th>Fecha</Th>
                    <Th>Productos</Th>
                    <Th>Total</Th>
                    <Th>Forma de pago</Th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.ventas.map((v, index) => (
                    <Tr key={v.id} index={index}>
                      <td className="px-3 py-3 whitespace-nowrap">{formatoFechaVenta(v.fecha)}</td>
                      <td className="px-3 py-3">{v.productos || '—'}</td>
                      <td className="px-3 py-3 font-bold text-[#4ADE80]">{formatoARS(v.total)}</td>
                      <td className="px-3 py-3">
                        <BadgePago forma={v.forma_pago} />
                      </td>
                    </Tr>
                  ))}
                </tbody>
              </table>
              {ficha.ventas.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-[#94A3B8]">Todavía no hay ventas de este cliente.</p>
              ) : null}
            </TableCard>

            <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-[#94A3B8]">Diario del cliente</h2>
            <section className="p-5" style={cardShell}>
              <div className="space-y-3">
                <select className={inputDark} value={tipoNota} onChange={(ev) => setTipoNota(ev.target.value)}>
                  {TIPOS_INTERACCION.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <textarea
                  className="min-h-[88px] w-full rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 py-2 text-sm text-[#F1F5F9]"
                  placeholder="¿Qué contó, qué prefiere, qué hay que recordar?"
                  value={contenido}
                  onChange={(ev) => setContenido(ev.target.value)}
                />
                <label className="flex items-center justify-between text-sm text-[#94A3B8]">
                  Privado (solo lo ve el dueño)
                  <button
                    type="button"
                    role="switch"
                    aria-checked={privado}
                    className={`relative h-7 w-12 rounded-full ${privado ? 'bg-[#6366F1]' : 'bg-white/20'}`}
                    onClick={() => setPrivado((v) => !v)}
                  >
                    <span
                      className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow"
                      style={{ left: privado ? 23 : 3 }}
                    />
                  </button>
                </label>
                <button className={btnPrimary} type="button" disabled={guardandoNota} onClick={() => void guardarNota()}>
                  {guardandoNota ? 'GUARDANDO…' : 'Guardar nota'}
                </button>
              </div>
              <ul className="mt-6 space-y-3">
                {ficha.interacciones.map((n) => (
                  <li key={n.id} className="rounded-xl border border-[rgba(99,102,241,0.15)] px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
                      <span className="font-semibold text-[#A5B4FC]">{etiquetaTipo(n.tipo)}</span>
                      <span>
                        {formatoFechaVenta(n.created_at)}
                        {n.privado ? ' · privado' : ''}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[#F1F5F9]">{n.contenido}</p>
                  </li>
                ))}
              </ul>
              {ficha.interacciones.length === 0 ? (
                <p className="mt-4 text-sm text-[#94A3B8]">Todavía no hay notas en el diario.</p>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
