import { memo, useMemo } from 'react'
import { ComposedChart, CartesianGrid, XAxis, YAxis, Bar, Line, Legend, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'
import { GraficoExpandible } from './GraficoExpandible'
import { CHART_CURSOR_FILL, TooltipInflacionPrecios, asRechartsTooltip } from './CustomTooltip'
import { type SerieInflacionPrecios } from '../lib/inflacion'
import { coloresGrafico, useTema } from '../lib/tema'

function fmtPct(n: number | null) {
  if (n == null || !Number.isFinite(n)) return 's/d'
  return `${n.toFixed(1)}%`
}

function tickPct(v: number) {
  return `${v}%`
}

export const InflacionVsPreciosPanel = memo(function InflacionVsPreciosPanel({
  serie,
}: {
  serie: SerieInflacionPrecios
}) {
  const { tema } = useTema()
  const g = useMemo(() => coloresGrafico(tema), [tema])
  const r = serie.resumen
  const puntos = serie.puntos
  const diff = r.diferenciaPct
  const ganaste = diff != null && diff > 0
  const perdiste = diff != null && diff < 0

  return (
    <>
      <GraficoExpandible titulo="Inflación vs evolución de tus precios" compactoClass="min-h-[360px]">
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted, #94A3B8)' }}>
          Compará cómo evolucionaron tus precios vs la inflación del período
        </p>
        {serie.errorInflacion ? (
          <p className="flex h-40 items-center justify-center text-center text-sm text-[#94A3B8]">
            {serie.errorInflacion}
          </p>
        ) : puntos.length === 0 ? (
          <p className="flex h-64 items-center justify-center text-sm text-[#94A3B8]">Sin meses en el período</p>
        ) : (
          <div className="relative h-72">
            <div
              className="pointer-events-none absolute right-0 top-0 z-10 max-w-[240px] text-left"
              style={{
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 8,
                padding: 12,
              }}
            >
              <p className="text-xs font-semibold text-[#F1F5F9]">Resumen del período</p>
              <p className="mt-2 text-[11px] text-[#CBD5E1]">Inflación acumulada: {fmtPct(r.inflacionAcumuladaPct)}</p>
              <p className="mt-1 text-[11px] text-[#A5B4FC]">Tus precios subieron: {fmtPct(r.variacionPreciosPct)}</p>
              {ganaste ? (
                <p className="mt-2 text-[11px] font-semibold text-[#4ADE80]">
                  ✅ Ganaste +{Math.abs(diff).toFixed(1)}% al ritmo inflacionario
                </p>
              ) : perdiste ? (
                <p className="mt-2 text-[11px] font-semibold text-[#F87171]">
                  ⚠️ Perdiste {Math.abs(diff).toFixed(1)}% vs inflación
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-[#94A3B8]">Sin datos suficientes de precios</p>
              )}
              {r.valorRealDe100 != null ? (
                <p className="mt-2 text-[11px] leading-snug text-[#94A3B8]">
                  En promedio cada $100 de producto hoy vale ${r.valorRealDe100.toFixed(0)} en términos reales
                </p>
              ) : null}
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={puntos} margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
                <CartesianGrid stroke={g.grilla} vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: g.eje, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="propios"
                  tick={{ fill: g.eje, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={tickPct}
                  width={48}
                />
                <YAxis
                  yAxisId="indec"
                  orientation="right"
                  domain={[0, 30]}
                  tick={{ fill: g.eje, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={tickPct}
                  width={40}
                />
                <RechartsTooltip cursor={{ fill: CHART_CURSOR_FILL }} content={asRechartsTooltip(TooltipInflacionPrecios)} />
                <Legend wrapperStyle={{ color: g.eje, fontSize: 12 }} />
                <Bar
                  yAxisId="indec"
                  dataKey="inflacion"
                  name="Inflación INDEC"
                  fill="#94A3B8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="propios"
                  type="monotone"
                  dataKey="variacion"
                  name="Tus precios"
                  stroke="#6366F1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#6366F1' }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </GraficoExpandible>
      <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
        Compará si tus precios le ganaron a la inflación. Si tu línea está por encima de las barras, mantuviste el
        poder adquisitivo.
      </p>
      {serie.errorInflacion ? null : (
      <p
        className="mt-4 rounded-lg px-3 py-3 text-sm"
        style={{
          background: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.35)',
          color: '#F1F5F9',
        }}
      >
        {serie.insight === 'menos'
          ? '⚠️ Tus precios subieron menos que la inflación. Puede que estés perdiendo rentabilidad.'
          : serie.insight === 'mas'
            ? '✅ Tus precios le ganaron a la inflación.'
            : '📊 Modificá el precio de tus productos para ver cómo evolucionan vs la inflación.'}
      </p>
      )}
    </>
  )
})
