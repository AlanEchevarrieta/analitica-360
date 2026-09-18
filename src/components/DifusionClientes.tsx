import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClienteFila } from '../lib/clientes'
import {
  ETIQUETA_SEGMENTO_DIFUSION,
  MAX_MENSAJE_DIFUSION,
  PLANTILLAS_DIFUSION,
  VARIABLES_DIFUSION,
  conTelefono,
  destinatariosDifusion,
  fechaHoyDifusion,
  guardarDifusion,
  interpolarMensaje,
  linkWhatsAppDifusion,
  listarDifusiones,
  type DestinatarioDifusion,
  type DifusionFila,
  type IdDestinoDifusion,
} from '../lib/difusiones'
import { formatoFechaHora } from '../lib/fechas'
import type { SegmentosClientes } from '../lib/segmentosClientes'
import { requireSupabase } from '../lib/supabase'

const OPCIONES: { id: IdDestinoDifusion; label: (n: number) => string }[] = [
  { id: 'todos', label: (n) => `Todos los clientes (${n} clientes)` },
  { id: 'inactivos', label: (n) => `Clientes inactivos +60 días (${n} clientes)` },
  { id: 'en_riesgo', label: (n) => `Clientes en riesgo 30-60 días (${n} clientes)` },
  { id: 'vip', label: (n) => `Clientes VIP (${n} clientes)` },
  { id: 'cumpleanos_mes', label: (n) => `Cumpleaños este mes (${n} clientes)` },
  { id: 'manual', label: () => 'Selección manual (checkbox por cliente)' },
]

function truncar(texto: string, n = 72) {
  const t = texto.replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t || '—'
  return `${t.slice(0, n)}…`
}

function insertarEn(texto: string, start: number, end: number, chip: string) {
  return {
    next: `${texto.slice(0, start)}${chip}${texto.slice(end)}`.slice(0, MAX_MENSAJE_DIFUSION),
    cursor: start + chip.length,
  }
}

export function DifusionClientes({
  clientes,
  segmentos,
  cumpleMes,
  empresaId,
  usuarioId,
  marca,
}: {
  clientes: ClienteFila[]
  segmentos: SegmentosClientes | null
  cumpleMes: DestinatarioDifusion[]
  empresaId: string
  usuarioId: string
  marca: string
}) {
  const [destino, setDestino] = useState<IdDestinoDifusion>('todos')
  const [idsManual, setIdsManual] = useState<Set<string>>(() => new Set())
  const [mensaje, setMensaje] = useState('')
  const [plantilla, setPlantilla] = useState('')
  const [historial, setHistorial] = useState<DifusionFila[]>([])
  const [errorHist, setErrorHist] = useState<string | null>(null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [modal, setModal] = useState<{ nombre: string; url: string }[] | null>(null)
  const [guardando, setGuardando] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  const conteos = useMemo(() => {
    return {
      todos: clientes.length,
      inactivos: segmentos?.conteos.inactivos ?? segmentos?.inactivos.length ?? 0,
      en_riesgo: segmentos?.conteos.en_riesgo ?? segmentos?.en_riesgo.length ?? 0,
      vip: segmentos?.conteos.vip ?? segmentos?.vip.length ?? 0,
      cumpleanos_mes: cumpleMes.length,
      manual: idsManual.size,
    } satisfies Record<IdDestinoDifusion, number>
  }, [clientes.length, cumpleMes.length, idsManual.size, segmentos])

  const destinos = useMemo(
    () =>
      destinatariosDifusion({
        destino,
        clientes,
        segmentos,
        cumpleMes,
        idsManual,
      }),
    [clientes, cumpleMes, destino, idsManual, segmentos],
  )
  const enviables = useMemo(() => conTelefono(destinos), [destinos])
  const empresa = marca.trim() || 'Acacia'
  const fecha = fechaHoyDifusion()
  const preview = interpolarMensaje(mensaje, {
    nombre: enviables[0]?.nombre.trim() || 'María García',
    empresa,
    fecha,
  })

  useEffect(() => {
    let vivo = true
    void listarDifusiones(requireSupabase()).then((res) => {
      if (!vivo) return
      setHistorial(res.filas)
      setErrorHist(res.error)
    })
    return () => {
      vivo = false
    }
  }, [])

  function onChip(chip: string) {
    const el = areaRef.current
    const start = el?.selectionStart ?? mensaje.length
    const end = el?.selectionEnd ?? mensaje.length
    const { next, cursor } = insertarEn(mensaje, start, end, chip)
    setMensaje(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(cursor, cursor)
    })
  }

  async function abrirModal() {
    setErrorEnvio(null)
    if (!mensaje.trim()) {
      setErrorEnvio('Escribí un mensaje antes de abrir WhatsApp.')
      return
    }
    if (enviables.length === 0) {
      setErrorEnvio('Ningún destinatario tiene teléfono válido.')
      return
    }
    setGuardando(true)
    const fallo = await guardarDifusion(requireSupabase(), {
      empresaId,
      usuarioId,
      segmento: destino,
      mensaje: mensaje.trim(),
      cantidad: enviables.length,
    })
    setGuardando(false)
    if (fallo) {
      setErrorEnvio(fallo)
      return
    }
    const links = enviables
      .map((c) => {
        const texto = interpolarMensaje(mensaje, { nombre: c.nombre.trim() || 'ahí', empresa, fecha })
        const url = linkWhatsAppDifusion(c.telefono ?? '', texto)
        if (!url) return null
        return { nombre: c.nombre, url }
      })
      .filter((x): x is { nombre: string; url: string } => x != null)
    setModal(links)
    const hist = await listarDifusiones(requireSupabase())
    setHistorial(hist.filas)
    setErrorHist(hist.error)
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
          {String.fromCodePoint(0x1f4e2)} Mensajes de difusión
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Enviá un mensaje a múltiples clientes a la vez por WhatsApp
        </p>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
          Paso 1 — Seleccionar destinatarios
        </h3>
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">Segmento</legend>
          {OPCIONES.map((op) => (
            <label key={op.id} className="flex cursor-pointer items-start gap-2 text-sm" style={{ color: 'var(--text)' }}>
              <input
                checked={destino === op.id}
                className="mt-0.5"
                name="segmento-difusion"
                type="radio"
                onChange={() => setDestino(op.id)}
              />
              <span>{op.label(conteos[op.id])}</span>
            </label>
          ))}
        </fieldset>

        {destino === 'manual' ? (
          <ul className="mt-4 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-[#E2E8F0] p-2">
            {clientes.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                  <input
                    checked={idsManual.has(c.id)}
                    type="checkbox"
                    onChange={() => {
                      setIdsManual((prev) => {
                        const next = new Set(prev)
                        if (next.has(c.id)) next.delete(c.id)
                        else next.add(c.id)
                        return next
                      })
                    }}
                  />
                  <span className="font-medium">{c.nombre}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {c.telefono ?? 'Sin teléfono'}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Vas a enviar a {enviables.length} {enviables.length === 1 ? 'cliente' : 'clientes'}
        </p>
        <ul className="mt-2 space-y-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {enviables.slice(0, 5).map((c) => (
            <li key={c.id}>
              {c.nombre} · {c.telefono}
            </li>
          ))}
          {enviables.length > 5 ? <li>… y {enviables.length - 5} más</li> : null}
          {enviables.length === 0 ? <li>Nadie con teléfono en este segmento.</li> : null}
        </ul>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
          Paso 2 — Redactar mensaje
        </h3>
        <label className="mt-3 block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Plantillas predefinidas
          <select
            className="mt-1 h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#1A2F4A]"
            value={plantilla}
            onChange={(e) => {
              const id = e.target.value
              setPlantilla(id)
              const p = PLANTILLAS_DIFUSION.find((x) => x.id === id)
              if (p) setMensaje(p.texto.slice(0, MAX_MENSAJE_DIFUSION))
            }}
          >
            <option value="">Elegí una plantilla</option>
            {PLANTILLAS_DIFUSION.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Variables disponibles
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {VARIABLES_DIFUSION.map((v) => (
            <button
              key={v.id}
              className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-xs font-semibold text-[#6366F1] hover:bg-[#EEF2FF]"
              type="button"
              onClick={() => onChip(v.chip)}
            >
              {v.chip}
            </button>
          ))}
        </div>
        <textarea
          ref={areaRef}
          className="mt-3 min-h-36 w-full rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/30"
          maxLength={MAX_MENSAJE_DIFUSION}
          placeholder={'Escribí tu mensaje aquí...\nPodés usar {nombre} para personalizar'}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value.slice(0, MAX_MENSAJE_DIFUSION))}
        />
        <p className="mt-1 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
          {mensaje.length} / {MAX_MENSAJE_DIFUSION}
        </p>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
          Paso 3 — Preview y envío
        </h3>
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-[#F8FAFC] p-3 text-sm text-[#1A2F4A]">
          {mensaje.trim() ? preview : 'El preview aparece cuando escribas el mensaje.'}
        </p>
        {errorEnvio ? <p className="mt-3 text-sm text-red-300">{errorEnvio}</p> : null}
        <button
          className="mt-4 inline-flex h-11 items-center rounded-lg bg-[#16A34A] px-4 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-50"
          disabled={guardando}
          type="button"
          onClick={() => void abrirModal()}
        >
          {String.fromCodePoint(0x1f4f1)} Abrir WhatsApp para cada cliente
        </button>
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          WhatsApp no permite envíos automáticos. Tocá cada botón para abrir el chat con cada cliente.
        </p>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
          Historial de difusiones
        </h3>
        {errorHist ? <p className="mt-2 text-sm text-amber-200">{errorHist}</p> : null}
        {historial.length === 0 && !errorHist ? (
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Todavía no hay difusiones guardadas.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="px-2 py-2 font-semibold">Fecha</th>
                  <th className="px-2 py-2 font-semibold">Segmento</th>
                  <th className="px-2 py-2 font-semibold">Mensaje</th>
                  <th className="px-2 py-2 font-semibold">Destinatarios</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id} className="border-t border-white/10">
                    <td className="px-2 py-2" style={{ color: 'var(--text)' }}>
                      {h.fecha ? formatoFechaHora(h.fecha) : '—'}
                    </td>
                    <td className="px-2 py-2" style={{ color: 'var(--text)' }}>
                      {ETIQUETA_SEGMENTO_DIFUSION[h.segmento as IdDestinoDifusion] ?? h.segmento}
                    </td>
                    <td className="px-2 py-2" style={{ color: 'var(--text-muted)' }}>
                      {truncar(h.mensaje)}
                    </td>
                    <td className="px-2 py-2" style={{ color: 'var(--text)' }}>
                      {h.cantidad}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
            role="dialog"
            aria-labelledby="difusion-modal-titulo"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="difusion-modal-titulo" className="text-base font-bold text-[#1A2F4A]">
                Enviar por WhatsApp
              </h3>
              <button className="text-sm font-semibold text-[#4A5568]" type="button" onClick={() => setModal(null)}>
                Cerrar
              </button>
            </div>
            <p className="mt-2 text-xs text-[#4A5568]">
              WhatsApp no permite envíos automáticos. Tocá cada botón para abrir el chat con cada cliente.
            </p>
            <ul className="mt-4 space-y-2">
              {modal.map((item) => (
                <li
                  key={item.url}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] px-3 py-2"
                >
                  <span className="text-sm font-medium text-[#1A2F4A]">{item.nombre}</span>
                  <a
                    className="inline-flex h-9 items-center rounded-md bg-[#16A34A] px-3 text-xs font-semibold text-white hover:bg-[#15803D]"
                    href={item.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Enviar
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  )
}
