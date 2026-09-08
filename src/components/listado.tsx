import type { ReactNode } from 'react'
import { theme } from '../theme'

export const cardShell = {
  border: '1px solid rgba(99,102,241,0.15)',
  borderRadius: 12,
  background: 'rgba(15,23,41,0.6)',
} as const

export const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#6366F1] px-4 text-sm font-semibold text-white hover:bg-[#4F46E5]'

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
        <h1 className="text-[28px] font-semibold leading-tight text-[#F1F5F9]" style={{ fontFamily: theme.fontDisplay }}>
          {titulo}
        </h1>
        {subtitulo ? (
          <p className="mt-1 text-[13px] text-[#94A3B8]" style={{ fontFamily: theme.fontSubtitle }}>
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
    <div className="overflow-x-auto text-sm text-[#F1F5F9]" style={cardShell}>
      {children}
    </div>
  )
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-3 text-left text-[11px] font-semibold uppercase text-[#94A3B8] ${className}`}
      style={{ letterSpacing: '0.08em' }}
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
      className={`group border-b border-white/[0.04] transition-colors duration-200 hover:bg-[rgba(99,102,241,0.06)] ${className}`}
      style={{ background: index % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
    >
      {children}
    </tr>
  )
}

export const theadClass = 'border-b border-[rgba(99,102,241,0.2)]'
export const theadStyle = { background: 'rgba(99,102,241,0.1)' }

export function BadgeEstado({ activo }: { activo: boolean }) {
  if (activo) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[2px] text-xs font-medium text-[#4ADE80]" style={{ background: 'rgba(74,222,128,0.1)' }}>
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
        activo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[2px] text-xs font-medium text-[#94A3B8]" style={{ background: 'rgba(148,163,184,0.12)' }}>
      <span className="h-1.5 w-1.5 rounded-full bg-[#94A3B8]" />
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
    <span className="inline-flex rounded-full px-2.5 py-[2px] text-xs font-medium" style={{ background: c.bg, color: c.fg }}>
      {c.label}
    </span>
  )
}

export function BadgeMargen({ pct }: { pct: number | null }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className="text-[#94A3B8]">—</span>
  }
  const color = pct > 40 ? '#4ADE80' : pct >= 20 ? '#F59E0B' : '#F87171'
  const bg = pct > 40 ? 'rgba(74,222,128,0.12)' : pct >= 20 ? 'rgba(245,158,11,0.12)' : 'rgba(248,113,113,0.12)'
  return (
    <span className="inline-flex rounded-full px-2.5 py-[2px] text-xs font-medium" style={{ background: bg, color }}>
      {pct.toFixed(0)}%
    </span>
  )
}

export function StockCelda({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-[#F87171]">
        ⚠️ {stock}
      </span>
    )
  }
  if (stock <= 5) {
    return <span className="font-medium text-[#F59E0B]">{stock}</span>
  }
  return <span className="font-medium text-[#4ADE80]">{stock}</span>
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
    <label className="relative block min-w-[220px] flex-1 sm:max-w-md">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
        </svg>
      </span>
      <input
        className="h-11 w-full rounded-lg border bg-white/[0.04] py-2 pl-10 pr-3 text-sm text-[#F1F5F9] outline-none placeholder:text-[#64748B]"
        style={{ borderColor: 'rgba(99,102,241,0.3)' }}
        placeholder={placeholder}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        onFocus={(ev) => {
          ev.currentTarget.style.borderColor = '#6366F1'
        }}
        onBlur={(ev) => {
          ev.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
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
      className={`rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/10 hover:text-white disabled:opacity-50 ${
        hoverOnly ? 'opacity-0 transition-opacity group-hover:opacity-100' : ''
      }`}
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
