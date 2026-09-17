import { Link } from 'react-router-dom'
import {
  META_SEGMENTO,
  detalleSegmento,
  linkWhatsAppSegmento,
  type ClienteSegmento,
  type IdSegmento,
  type SegmentosClientes,
} from '../lib/segmentosClientes'

const ORDEN: IdSegmento[] = ['inactivos', 'en_riesgo', 'cumpleanos', 'vip']

export function SegmentosCards({
  data,
  onAbrir,
}: {
  data: SegmentosClientes
  onAbrir: (id: IdSegmento) => void
}) {
  return (
    <section className="mb-6 rounded-xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
      <h2 className="mb-3 text-sm font-bold" style={{ color: 'var(--text)' }}>
        👥 Segmentos inteligentes
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ORDEN.map((id) => {
          const meta = META_SEGMENTO[id]
          const n = id === 'vip' ? data.vip.length : data.conteos[id]
          return (
            <article
              key={id}
              className="flex flex-col rounded-lg p-3"
              style={{ border: `1px solid ${meta.borde}`, background: 'rgba(255,255,255,0.03)' }}
            >
              <p className="text-lg" aria-hidden>
                {meta.icono}
              </p>
              <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text)' }}>
                {meta.titulo}
              </p>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {meta.sub}
              </p>
              <p className="mt-2 font-metric text-lg" style={{ color: 'var(--text)' }}>
                {n} {n === 1 ? 'clt' : 'clts'}
              </p>
              <button
                className="mt-2 text-left text-xs font-semibold text-[#A5B4FC] hover:underline"
                type="button"
                onClick={() => onAbrir(id)}
              >
                {meta.accion}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function ChipsSegmento({
  activo,
  conteos,
  onChange,
}: {
  activo: IdSegmento | 'todos'
  conteos: Record<IdSegmento, number>
  onChange: (id: IdSegmento | 'todos') => void
}) {
  const chips: { id: IdSegmento | 'todos'; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'inactivos', label: '🔴 Inactivos' },
    { id: 'en_riesgo', label: '🟡 En riesgo' },
    { id: 'cumpleanos', label: '🎂 Cumpleaños' },
    { id: 'vip', label: '⭐ VIP' },
  ]
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {chips.map((c) => {
        const n = c.id === 'todos' ? null : conteos[c.id]
        const sel = activo === c.id
        return (
          <button
            key={c.id}
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              sel ? 'bg-[#6366F1] text-white' : 'bg-white/10 text-[#A5B4FC]'
            }`}
            onClick={() => onChange(c.id)}
          >
            {c.label}
            {n != null ? ` (${n})` : ''}
          </button>
        )
      })}
    </div>
  )
}

export function ModalSegmento({
  id,
  filas,
  marca,
  onCerrar,
}: {
  id: IdSegmento
  filas: ClienteSegmento[]
  marca: string
  onCerrar: () => void
}) {
  const meta = META_SEGMENTO[id]
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-[440px] rounded-lg bg-white/95 p-6 text-[#1A2F4A] shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">
            {meta.icono} {meta.titulo}
          </h2>
          <button className="text-sm font-semibold text-[#4A5568]" type="button" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
        {filas.length === 0 ? (
          <p className="text-sm text-[#4A5568]">No hay clientes en este segmento.</p>
        ) : (
          <ul className="space-y-3">
            {filas.map((c) => {
              const wa = linkWhatsAppSegmento(id, c, marca)
              return (
                <li key={c.id} className="rounded-lg border border-[#E2E8F0] px-3 py-3">
                  <Link className="font-semibold text-[#1A2F4A] hover:text-[#6366F1]" to={`/clientes/${c.id}`}>
                    {c.nombre}
                  </Link>
                  <p className="mt-0.5 text-xs text-[#4A5568]">{detalleSegmento(id, c)}</p>
                  {wa ? (
                    <button
                      className="mt-2 inline-flex h-9 items-center rounded-md bg-[#16A34A] px-3 text-xs font-semibold text-white hover:bg-[#15803D]"
                      type="button"
                      onClick={() => {
                        alert(wa.mensaje)
                        window.open(wa.url, '_blank', 'noopener,noreferrer')
                      }}
                    >
                      📱 WhatsApp
                    </button>
                  ) : (
                    <p className="mt-2 text-xs text-[#94A3B8]">Sin teléfono</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
