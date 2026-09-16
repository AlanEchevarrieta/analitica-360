import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { IdNotif, ItemNotif } from '../lib/notificaciones'
import { theme } from '../theme'

function BadgeCampana({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span className="nav-notif-badge" aria-label={`${n} notificaciones`}>
      {n > 9 ? '9+' : n}
    </span>
  )
}

export function NotificacionesCampana({
  items,
  total,
  abrirArriba,
  marcar,
  marcarTodas,
}: {
  items: ItemNotif[]
  total: number
  abrirArriba?: boolean
  marcar: (id: IdNotif) => void
  marcarTodas: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function onDoc(ev: MouseEvent) {
      if (root.current && !root.current.contains(ev.target as Node)) setAbierto(false)
    }
    function onEsc(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [abierto])

  return (
    <div className="relative" ref={root}>
      <button
        className="nav-campana theme-toggle"
        type="button"
        aria-label="Notificaciones"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="relative inline-block leading-none">
          🔔
          <BadgeCampana n={total} />
        </span>
      </button>
      {abierto ? (
        <div
          className={`nav-notif-dropdown ${abrirArriba ? 'nav-notif-dropdown-up' : ''}`}
          role="menu"
          style={{ fontFamily: theme.font }}
        >
          <div className="flex items-start justify-between gap-2 px-4 py-3">
            <p className="text-sm font-semibold text-white">Notificaciones</p>
            {items.length > 0 ? (
              <button
                className="text-xs font-medium text-[#A5B4FC] hover:underline"
                type="button"
                onClick={() => {
                  marcarTodas()
                  setAbierto(false)
                }}
              >
                Marcar todas como leídas
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <div className="px-4 pb-4 text-center">
              <p className="text-2xl" aria-hidden>
                🎉
              </p>
              <p className="mt-2 text-sm text-[#94A3B8]">Todo al día — no tenés notificaciones</p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto pb-2">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    className="nav-notif-item"
                    to={item.to}
                    role="menuitem"
                    onClick={() => {
                      marcar(item.id)
                      setAbierto(false)
                    }}
                  >
                    <span className="text-base" aria-hidden>
                      {item.icono}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-[#E2E8F0]">{item.texto}</span>
                    <span className="shrink-0 text-[11px] text-[#94A3B8]">{item.tiempo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
