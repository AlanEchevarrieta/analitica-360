import { useState, type ReactNode } from 'react'
import { formatoARS } from '../lib/productos'
import { fechaExactaLarga, variacionPct } from '../lib/analytics'

export const CHART_TOOLTIP_STYLE = {
  background: '#1E293B',
  border: '1px solid rgba(99,102,241,0.4)',
  borderRadius: 10,
  padding: '12px 16px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
} as const

export const CHART_CURSOR_FILL = 'rgba(99,102,241,0.1)'
export const CHART_BAR_BG = 'rgba(99,102,241,0.15)'
export const CHART_ACTIVE_BAR = 'rgba(99,102,241,0.9)'

export function useIndiceBarraActiva() {
  const [activo, setActivo] = useState<number | null>(null)
  return {
    activo,
    onMouseMove: (s: { activeTooltipIndex?: unknown }) => {
      const i = s?.activeTooltipIndex
      if (i == null || i === '') {
        setActivo(null)
        return
      }
      const n = Number(i)
      setActivo(Number.isFinite(n) ? n : null)
    },
    onMouseLeave: () => setActivo(null),
  }
}

type TipProps = {
  active?: boolean
  payload?: readonly {
    value?: unknown
    name?: unknown
    dataKey?: unknown
    payload?: Record<string, unknown>
    percent?: number
  }[]
  label?: unknown
}

export function asRechartsTooltip(fn: (props: TipProps) => ReactNode) {
  return fn as never
}

export function ChartTooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="custom-chart-tooltip" style={CHART_TOOLTIP_STYLE}>
      {children}
    </div>
  )
}

export const CustomTooltip = ChartTooltipBox

export function etiquetaDiaLargo(fecha: string) {
  const raw = String(fecha).slice(0, 10)
  const [y, m, d] = raw.split('-').map(Number)
  const dt = y && m && d ? new Date(y, m - 1, d) : new Date(fecha)
  if (Number.isNaN(dt.getTime())) return fecha
  const weekday = dt.toLocaleDateString('es-AR', { weekday: 'long' })
  const day = dt.getDate()
  const month = dt.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  const mon = month.charAt(0).toUpperCase() + month.slice(1)
  return `${cap} ${day} ${mon}`
}

export function colorBarraMargen(margenPct: number | null | undefined, tieneCosto: boolean) {
  if (!tieneCosto || margenPct == null || Number.isNaN(margenPct)) return '#6366F1'
  if (margenPct > 40) return '#4ADE80'
  if (margenPct >= 20) return '#FCD34D'
  return '#F87171'
}

export function colorTextoMargen(margenPct: number) {
  if (margenPct > 40) return '#4ADE80'
  if (margenPct >= 20) return '#FCD34D'
  return '#F87171'
}

export function TooltipBarras7Dias({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const row = (payload[0].payload ?? {}) as { fecha?: string; dia?: string; total?: number; cantidad?: number }
  const total = Number(row.total ?? payload[0].value ?? 0)
  const fecha = etiquetaDiaLargo(String(row.fecha ?? ''))
  if (!(total > 0)) {
    return (
      <ChartTooltipBox>
        <p style={{ color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>Sin ventas este día</p>
      </ChartTooltipBox>
    )
  }
  const cant = row.cantidad
  return (
    <ChartTooltipBox>
      <p style={{ color: '#94A3B8', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{fecha}</p>
      <p style={{ color: '#F1F5F9', fontSize: 18, fontWeight: 700, marginTop: 4 }}>{formatoARS(total)}</p>
      {cant != null && Number.isFinite(Number(cant)) ? (
        <p style={{ color: '#6366F1', fontSize: 12, marginTop: 4 }}>
          {Number(cant)} {Number(cant) === 1 ? 'transacción' : 'transacciones'}
        </p>
      ) : null}
    </ChartTooltipBox>
  )
}

export function TooltipEvolucion({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  const row = (payload[0].payload ?? {}) as { fechaExacta?: string; Ventas?: number; Anterior?: number }
  const actual = Number(payload.find((x) => x.name === 'Ventas' || (x as { dataKey?: string }).dataKey === 'Ventas')?.value ?? row.Ventas ?? 0)
  const antRaw = payload.find((x) => x.name === 'Anterior' || (x as { dataKey?: string }).dataKey === 'Anterior')
  const hayAnt = antRaw != null || ('Anterior' in row && row.Anterior != null)
  const ant = Number(antRaw?.value ?? row.Anterior ?? 0)
  const iso = row.fechaExacta
  const fecha = iso ? fechaExactaLarga(iso) : String(label ?? '')
  const pct = variacionPct(actual, ant)
  const up = pct > 0.05
  const down = pct < -0.05
  return (
    <ChartTooltipBox>
      <p style={{ color: '#94A3B8', fontSize: 11 }}>{fecha}</p>
      <p style={{ color: '#F1F5F9', fontSize: 13, marginTop: 6 }}>Ventas período actual: {formatoARS(actual)}</p>
      {hayAnt ? (
        <p style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>Ventas período anterior: {formatoARS(ant)}</p>
      ) : null}
      {hayAnt ? (
        <p
          style={{
            color: up ? '#4ADE80' : down ? '#F87171' : '#94A3B8',
            fontSize: 13,
            marginTop: 4,
            fontWeight: 600,
          }}
        >
          Diferencia: {up ? '↑' : down ? '↓' : '→'} {pct > 0 ? '+' : ''}
          {pct.toFixed(0)}%
        </p>
      ) : null}
    </ChartTooltipBox>
  )
}

export function TooltipTopProductos({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const row = (payload[0].payload ?? {}) as {
    nombre?: string
    producto?: string
    unidades?: number
    total?: number
    margen_pct?: number
    tieneCosto?: boolean
  }
  const nombre = String(row.nombre ?? row.producto ?? payload[0].name ?? '')
  const unidades = Number(row.unidades ?? payload[0].value ?? 0)
  const total = row.total
  const margen = row.margen_pct
  const tieneCosto = Boolean(row.tieneCosto) && margen != null
  return (
    <ChartTooltipBox>
      <p style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600 }}>{nombre}</p>
      <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 6 }}>Unidades: {unidades} u</p>
      {total != null ? (
        <p style={{ color: '#F1F5F9', fontSize: 12, marginTop: 2 }}>Total $: {formatoARS(Number(total))}</p>
      ) : null}
      {tieneCosto ? (
        <p style={{ color: colorTextoMargen(Number(margen)), fontSize: 12, marginTop: 2, fontWeight: 600 }}>
          Margen: {Number(margen).toFixed(1)}%
        </p>
      ) : null}
    </ChartTooltipBox>
  )
}

export function TooltipFormaPago({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const row = (p.payload ?? {}) as { name?: string; value?: number; cantidad?: number; porcentaje?: number }
  const nombre = String(row.name ?? p.name ?? '')
  const monto = Number(row.value ?? p.value ?? 0)
  const rawPct = row.porcentaje ?? (typeof p.percent === 'number' ? (p.percent <= 1 ? p.percent * 100 : p.percent) : 0)
  const pct = Number(rawPct)
  const trans = row.cantidad
  return (
    <ChartTooltipBox>
      <p style={{ color: '#94A3B8', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Forma de pago
      </p>
      <p style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600, marginTop: 4 }}>{nombre}</p>
      <p style={{ color: '#F1F5F9', fontSize: 12, marginTop: 6 }}>Monto: {formatoARS(monto)}</p>
      <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>Porcentaje: {pct.toFixed(0)}%</p>
      {trans != null ? (
        <p style={{ color: '#6366F1', fontSize: 12, marginTop: 2 }}>
          Transacciones: {Number(trans)}
        </p>
      ) : null}
    </ChartTooltipBox>
  )
}

export function TooltipUnidades({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <ChartTooltipBox>
      <p style={{ color: '#94A3B8', fontSize: 11 }}>{String(label ?? '')}</p>
      <p style={{ color: '#F1F5F9', fontSize: 16, fontWeight: 700, marginTop: 4 }}>
        {Number(payload[0].value ?? 0)} u
      </p>
    </ChartTooltipBox>
  )
}

export function TooltipMontoSimple({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  const total = Number(payload[0].value ?? 0)
  return (
    <ChartTooltipBox>
      <p style={{ color: '#94A3B8', fontSize: 11 }}>{String(label ?? '')}</p>
      <p style={{ color: '#F1F5F9', fontSize: 16, fontWeight: 700, marginTop: 4 }}>{formatoARS(total)}</p>
    </ChartTooltipBox>
  )
}
