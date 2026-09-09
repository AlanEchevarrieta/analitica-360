import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { theme } from '../theme'

export const cardShell = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  background: 'var(--card-bg)',
} as const

export const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#6366F1] px-4 text-sm font-semibold text-white hover:bg-[#4F46E5]'

export const btnPrimaryDesk = `${btnPrimary} hidden md:inline-flex`

export function PageTitle({
  titulo,
  subtitulo,
  accion,
}: {
  titulo: string
  subtitulo?: string
  accion?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1
          className="text-[28px] font-semibold leading-tight"
          style={{ fontFamily: theme.fontDisplay, color: 'var(--text)' }}
        >
          {titulo}
        </h1>
        {subtitulo ? (
          <p className="mt-1 text-[13px]" style={{ fontFamily: theme.fontSubtitle, color: 'var(--text-muted)' }}>
            {subtitulo}
          </p>
        ) : null}
      </div>
      {accion}
    </div>
  )
}

export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="text-sm" style={{ ...cardShell, color: 'var(--text)' }}>
      {children}
    </div>
  )
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-3 text-left text-[11px] font-semibold uppercase ${className}`}
      style={{ letterSpacing: '0.08em', color: 'var(--th-fg)' }}
    >
      {children}
    </th>
  )
}

export function Tr({
  children,
  index,
  className = '',
}: {
  children: ReactNode
  index: number
  className?: string
}) {
  return (
    <tr
      className={`group border-b transition-colors duration-200 ${className}`}
      style={{
        borderColor: 'var(--row-border)',
        background: index % 2 === 1 ? 'var(--row-alt)' : 'transparent',
      }}
      onMouseEnter={(ev) => {
        ev.currentTarget.style.background = 'var(--row-hover)'
      }}
      onMouseLeave={(ev) => {
        ev.currentTarget.style.background = index % 2 === 1 ? 'var(--row-alt)' : 'transparent'
      }}
    >
      {children}
    </tr>
  )
}

export const theadClass = 'border-b'
export const theadStyle = { background: 'var(--table-head)', borderColor: 'var(--border)' }

export function BadgeEstado({ activo }: { activo: boolean }) {
  if (activo) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[2px] text-xs font-medium"
        style={{ background: 'var(--badge-on-bg)', color: 'var(--badge-on-fg)' }}
      >
        <span className="pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--badge-on-fg)' }} />
        activo
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[2px] text-xs font-medium"
      style={{ background: 'var(--badge-off-bg)', color: 'var(--badge-off-fg)' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--badge-off-fg)' }} />
      inactivo
    </span>
  )
}

const COLOR_PAGO: Record<string, { bg: string; fg: string; label: string }> = {
  efectivo: { bg: 'rgba(74,222,128,0.12)', fg: '#4ADE80', label: 'Efectivo' },
  transferencia: { bg: 'rgba(99,102,241,0.15)', fg: '#A5B4FC', label: 'Transferencia' },
  credito: { bg: 'rgba(139,92,246,0.15)', fg: '#C4B5FD', label: 'Crédito' },
  debito: { bg: 'rgba(56,189,248,0.15)', fg: '#38BDF8', label: 'Débito' },
  qr: { bg: 'rgba(245,158,11,0.15)', fg: '#F59E0B', label: 'MP QR' },
}

export function BadgePago({ forma }: { forma: string }) {
  const c = COLOR_PAGO[forma] ?? { bg: 'rgba(148,163,184,0.12)', fg: '#94A3B8', label: forma }
  return (
    <span
      className={`badge-pago badge-pago-${forma} inline-flex rounded-full px-2.5 py-[2px] text-xs font-medium`}
      style={{ background: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  )
}

export function BadgeMargen({ pct }: { pct: number | null }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className="text-[#94A3B8]">—</span>
  }
  const tono = pct > 40 ? 'alto' : pct >= 20 ? 'medio' : 'bajo'
  const color = pct > 40 ? '#4ADE80' : pct >= 20 ? '#F59E0B' : '#F87171'
  const bg = pct > 40 ? 'rgba(74,222,128,0.12)' : pct >= 20 ? 'rgba(245,158,11,0.12)' : 'rgba(248,113,113,0.12)'
  return (
    <span
      className={`badge-margen badge-margen-${tono} inline-flex rounded-full px-2.5 py-[2px] text-xs font-medium`}
      style={{ background: bg, color }}
    >
      {pct.toFixed(0)}%
    </span>
  )
}

export function StockCelda({
  stock,
  onClick,
}: {
  stock: number
  onClick?: () => void
}) {
  const clase =
    stock <= 0
      ? 'inline-flex items-center gap-1 font-medium text-[#F87171]'
      : stock <= 5
        ? 'font-medium text-[#F59E0B]'
        : 'font-medium text-[#4ADE80]'
  const contenido = stock <= 0 ? <>⚠️ {stock}</> : stock
  if (onClick) {
    return (
      <button
        className={`${clase} rounded-md px-1 hover:underline`}
        type="button"
        title="Ver movimientos"
        onClick={onClick}
      >
        {contenido}
      </button>
    )
  }
  return <span className={clase}>{contenido}</span>
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <label className="relative block min-w-0 w-full flex-1 sm:min-w-[220px] sm:max-w-md">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
        </svg>
      </span>
      <input
        className="h-11 w-full rounded-lg border py-2 pl-10 pr-3 text-sm outline-none"
        style={{
          borderColor: 'var(--input-border)',
          background: 'var(--input-bg)',
          color: 'var(--text)',
        }}
        placeholder={placeholder}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        onFocus={(ev) => {
          ev.currentTarget.style.borderColor = '#6366F1'
        }}
        onBlur={(ev) => {
          ev.currentTarget.style.borderColor = 'var(--input-border)'
        }}
      />
    </label>
  )
}

export function IconBtn({
  label,
  onClick,
  children,
  hoverOnly,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  hoverOnly?: boolean
}) {
  return (
    <button
      className={`rounded-lg p-1.5 disabled:opacity-50 ${
        hoverOnly ? 'opacity-0 transition-opacity group-hover:opacity-100' : ''
      }`}
      style={{ color: 'var(--text-muted)' }}
      type="button"
      title={label}
      aria-label={label}
      onClick={(ev) => {
        ev.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

export function ThFilter({
  label,
  active,
  open,
  onToggle,
  onClose,
  children,
}: {
  label: string
  active: boolean
  open: boolean
  onToggle: () => void
  onClose: () => void
  children: ReactNode
}) {
  const thRef = useRef<HTMLTableCellElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !thRef.current) return
    const r = thRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left })
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(ev: MouseEvent) {
      const t = ev.target as Node
      if (thRef.current?.contains(t) || menuRef.current?.contains(t)) return
      onClose()
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [open, onClose])

  return (
    <th
      ref={thRef}
      className="relative px-3 py-3 text-left text-[11px] font-semibold uppercase"
      style={{
        letterSpacing: '0.08em',
        color: 'var(--th-fg)',
        background: active ? 'var(--th-active-bg)' : undefined,
      }}
    >
      <button
        className="col-filter-btn"
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={(ev) => {
          ev.stopPropagation()
          onToggle()
        }}
      >
        {label}
        <span className={`col-filter-caret${active ? ' active' : ''}`} aria-hidden>
          ▼
        </span>
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="col-filter-menu"
              role="listbox"
              style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 80 }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </th>
  )
}

export function FabLink({ to, label }: { to: string; label: string }) {
  return (
    <Link className="fab-plus md:hidden" to={to} aria-label={label} title={label}>
      +
    </Link>
  )
}

export function FilterCollapse({
  children,
  activo,
  soloMobile,
}: {
  children: ReactNode
  activo?: boolean
  soloMobile?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className={soloMobile ? 'w-full md:hidden' : 'w-full'}>
      <button
        className="filter-toggle md:hidden"
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        Filtrar{activo ? ' •' : ''}
      </button>
      <div className={`filter-bar mb-0 ${abierto ? 'flex' : 'hidden'} ${soloMobile ? '' : 'md:flex'}`}>
        {children}
      </div>
    </div>
  )
}

export function MobileCards({ children }: { children: ReactNode }) {
  return <div className="space-y-2 p-2 md:hidden">{children}</div>
}

export function ListCard({ children, to }: { children: ReactNode; to?: string }) {
  const clase = 'list-card'
  if (to) {
    return (
      <Link className={clase} to={to}>
        {children}
      </Link>
    )
  }
  return <div className={clase}>{children}</div>
}

export const PAGE_VENTAS = 50
export const PAGE_COMPRAS = 50
export const PAGE_PRODUCTOS = 100
export const PAGE_PROVEEDORES = 50
export const PAGE_MOVIMIENTOS = 50

export function PaginacionBar({
  pagina,
  total,
  pageSize,
  onPagina,
  entidad,
}: {
  pagina: number
  total: number
  pageSize: number
  onPagina: (p: number) => void
  entidad: string
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize) || 1)
  const desde = total === 0 ? 0 : (pagina - 1) * pageSize + 1
  const hasta = Math.min(pagina * pageSize, total)
  return (
    <div className="paginacion">
      <p className="filter-meta" style={{ marginTop: 0 }}>
        Mostrando {desde}-{hasta} de {total} {entidad}
      </p>
      <div className="paginacion-controles">
        <button
          className="btn-paginacion"
          type="button"
          disabled={pagina <= 1 || total === 0}
          onClick={() => onPagina(pagina - 1)}
        >
          ← Anterior
        </button>
        <span className="paginacion-pagina">
          Página {total === 0 ? 0 : pagina} de {total === 0 ? 0 : totalPaginas}
        </span>
        <button
          className="btn-paginacion"
          type="button"
          disabled={pagina >= totalPaginas || total === 0}
          onClick={() => onPagina(pagina + 1)}
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}

export function TableSkeleton({ filas = 5 }: { filas?: number }) {
  return (
    <div className="tabla-skeleton-filas" aria-hidden>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="tabla-skeleton-fila" />
      ))}
    </div>
  )
}

export function TableErrorRed({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="px-3 py-8 text-center">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        No se pudieron cargar los datos — verificá tu conexión
      </p>
      <button className="btn-paginacion mt-3" type="button" onClick={onReintentar}>
        Reintentar
      </button>
    </div>
  )
}
