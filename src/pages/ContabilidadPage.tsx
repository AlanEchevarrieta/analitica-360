import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartResponsive, propsEjeX } from '../components/ChartResponsive'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { ChartTooltipBox } from '../components/CustomTooltip'
import { PageTitle, btnPrimary, cardShell } from '../components/listado'
import {
  acumuladoSerie,
  cargarContabilidad,
  proyectarFlujo,
  rangoContabilidad,
  ratiosFinancieros,
  semaforoMargenBruto,
  semaforoMargenNeto,
  type PresetContabilidad,
  type PuntoMes,
  type TotalesPeriodo,
  type ValorStock,
  VALOR_STOCK_VACIO,
} from '../lib/contabilidad'
import { fechaHoyAR, formatoEjeCompacto } from '../lib/analytics'
import { FISCAL_DEFAULT, formatoMoneda, type ConfigFiscal } from '../lib/fiscal'
import { obtenerConfiguracion } from '../lib/configuracion'
import {
  anularGasto,
  CATEGORIAS_GASTO,
  crearGasto,
  FRECUENCIAS_GASTO,
  listarGastos,
  metaCategoria,
  type CategoriaGasto,
  type FrecuenciaGasto,
  type GastoFila,
} from '../lib/gastos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

const CARD = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(99,102,241,0.2)',
} as const

type TabId = 'gastos' | 'resultado' | 'ratios' | 'flujo'

const TABS: { id: TabId; label: string }[] = [
  { id: 'gastos', label: 'Gastos' },
  { id: 'resultado', label: 'Resultado del período' },
  { id: 'ratios', label: 'Ratios financieros' },
  { id: 'flujo', label: 'Flujo de caja' },
]

const PRESETS: { id: PresetContabilidad; label: string }[] = [
  { id: 'mes', label: 'Mes actual' },
  { id: 'mes_ant', label: 'Mes anterior' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'anio', label: 'Año' },
  { id: 'personalizado', label: 'Personalizado' },
]

const COLOR_ING = '#6366F1'
const COLOR_COGS = '#F59E0B'
const COLOR_GAS = '#94A3B8'
const COLOR_NET = '#22C55E'
const COLOR_NEG = '#EF4444'

function colorSemaforo(s: 'verde' | 'amarillo' | 'rojo') {
  if (s === 'verde') return '#22C55E'
  if (s === 'amarillo') return '#EAB308'
  return '#EF4444'
}

function money(n: number, fiscal: ConfigFiscal) {
  return formatoMoneda(n, fiscal)
}

export function ContabilidadPage() {
  const { perfil } = useAuth()
  const [tab, setTab] = useState<TabId>('gastos')
  const [preset, setPreset] = useState<PresetContabilidad>('mes')
  const [desde, setDesde] = useState(() => rangoContabilidad('mes').desde)
  const [hasta, setHasta] = useState(() => rangoContabilidad('mes').hasta)
  const [filtroCat, setFiltroCat] = useState<CategoriaGasto | ''>('')
  const [gastos, setGastos] = useState<GastoFila[]>([])
  const [totales, setTotales] = useState<TotalesPeriodo>({
    ingresos: 0,
    cogs: 0,
    gastos: 0,
    neto: 0,
    cantidadVentas: 0,
  })
  const [serie6, setSerie6] = useState<PuntoMes[]>([])
  const [valorInv, setValorInv] = useState(0)
  const [valorStock, setValorStock] = useState<ValorStock>(VALOR_STOCK_VACIO)
  const [fiscal, setFiscal] = useState<ConfigFiscal>(FISCAL_DEFAULT)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const [catNueva, setCatNueva] = useState<CategoriaGasto>('otro')
  const [descNueva, setDescNueva] = useState('')
  const [montoNuevo, setMontoNuevo] = useState('')
  const [fechaNueva, setFechaNueva] = useState(fechaHoyAR)
  const [recurrente, setRecurrente] = useState(false)
  const [frecuencia, setFrecuencia] = useState<FrecuenciaGasto>('mensual')

  const rango = useMemo(() => rangoContabilidad(preset, desde, hasta), [preset, desde, hasta])

  async function recargar() {
    if (!perfil) return
    setCargando(true)
    setError(null)
    const client = requireSupabase()
    const cfg = await obtenerConfiguracion(client, perfil.empresa.id)
    setFiscal({
      pais: cfg.config.pais,
      moneda: cfg.config.moneda,
      simboloMoneda: cfg.config.simboloMoneda,
      alicuotaIva: cfg.config.alicuotaIva,
      nombreIva: cfg.config.nombreIva,
      mostrarIvaVentas: cfg.config.mostrarIvaVentas,
    })
    const pack = await cargarContabilidad(client, perfil.empresa.id, rango)
    setTotales(pack.totales)
    setSerie6(pack.serie6)
    setValorInv(pack.valorInventario)
    setValorStock(pack.valorStock)
    const lista = await listarGastos(client, {
      empresaId: perfil.empresa.id,
      desde: rango.desde,
      hasta: rango.hasta,
      categoria: filtroCat,
    })
    setGastos(lista.filas)
    setError(pack.error || lista.error)
    setCargando(false)
  }

  useEffect(() => {
    void recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil, rango.desde, rango.hasta, filtroCat])

  const gastosFijos = gastos.filter((g) => g.recurrente).reduce((a, g) => a + g.monto, 0)
  const ratios = ratiosFinancieros({
    ingresos: totales.ingresos,
    cogs: totales.cogs,
    gastos: totales.gastos,
    cantidadVentas: totales.cantidadVentas,
    valorInventario: valorInv,
    gastosFijos: gastosFijos > 0 ? gastosFijos : totales.gastos,
  })
  const proy = useMemo(() => proyectarFlujo(serie6, 3), [serie6])
  const flujoHist = useMemo(() => acumuladoSerie(serie6), [serie6])
  const flujoFull = useMemo(() => acumuladoSerie([...serie6, ...proy]), [serie6, proy])
  const chartFlujo = useMemo(() => {
    const lastHist = flujoHist[flujoHist.length - 1]
    return flujoFull.map((p, i) => {
      const esHist = i < serie6.length
      return {
        label: p.label,
        historico: esHist ? p.acumulado : null,
        proyeccion: !esHist || i === serie6.length - 1 ? p.acumulado : null,
        alerta: !esHist && p.resultado < 0,
        mes: p.label,
        resultado: p.resultado,
      }
    }).map((row, i) => {
      if (i === serie6.length - 1 && lastHist) {
        return { ...row, proyeccion: lastHist.acumulado }
      }
      return row
    })
  }, [flujoFull, flujoHist, serie6.length])
  const alertaProy = proy.find((p) => p.resultado < 0)

  async function onGuardarGasto(ev: FormEvent) {
    ev.preventDefault()
    if (!perfil) return
    const monto = Number(montoNuevo.replace(',', '.'))
    if (!descNueva.trim()) {
      setError('Escribí una descripción')
      return
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('El monto tiene que ser mayor a 0')
      return
    }
    setGuardando(true)
    const fallo = await crearGasto(requireSupabase(), {
      empresaId: perfil.empresa.id,
      usuarioId: perfil.usuario.id,
      categoria: catNueva,
      descripcion: descNueva,
      monto,
      fecha: fechaNueva,
      recurrente,
      frecuencia: recurrente ? frecuencia : null,
    })
    setGuardando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setModal(false)
    setDescNueva('')
    setMontoNuevo('')
    setRecurrente(false)
    await recargar()
  }

  async function onEliminar(id: string) {
    const fallo = await anularGasto(requireSupabase(), id)
    if (fallo) setError(fallo)
    else await recargar()
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
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 text-white">
        <AppNav />
        <PageTitle
          titulo="Contabilidad"
          subtitulo="Gastos, resultado, ratios y flujo de caja"
          accion={
            tab === 'gastos' ? (
              <button className={btnPrimary} type="button" onClick={() => setModal(true)}>
                Nuevo gasto
              </button>
            ) : null
          }
        />

        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                tab === t.id ? 'bg-[#6366F1] text-white' : 'bg-white/10 text-[#A5B4FC]'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mb-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}
        {cargando ? <p className="mb-4 text-sm text-[#94A3B8]">Cargando…</p> : null}

        {tab === 'gastos' ? (
          <section className="rounded-lg p-5" style={{ ...cardShell, ...CARD }}>
            <div className="mb-4 flex flex-wrap gap-3">
              <label className="text-sm text-[#94A3B8]">
                Categoría
                <select
                  className="mt-1 block h-10 rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9]"
                  value={filtroCat}
                  onChange={(ev) => setFiltroCat(ev.target.value as CategoriaGasto | '')}
                >
                  <option value="">Todas</option>
                  {CATEGORIAS_GASTO.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icono} {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-[#94A3B8]">
                Período
                <select
                  className="mt-1 block h-10 rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9]"
                  value={preset}
                  onChange={(ev) => {
                    const p = ev.target.value as PresetContabilidad
                    setPreset(p)
                    const r = rangoContabilidad(p)
                    setDesde(r.desde)
                    setHasta(r.hasta)
                  }}
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              {preset === 'personalizado' ? (
                <>
                  <label className="text-sm text-[#94A3B8]">
                    Desde
                    <input
                      className="mt-1 block h-10 rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9]"
                      type="date"
                      value={desde}
                      onChange={(ev) => setDesde(ev.target.value)}
                    />
                  </label>
                  <label className="text-sm text-[#94A3B8]">
                    Hasta
                    <input
                      className="mt-1 block h-10 rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9]"
                      type="date"
                      value={hasta}
                      onChange={(ev) => setHasta(ev.target.value)}
                    />
                  </label>
                </>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[#94A3B8]">
                  <tr>
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Categoría</th>
                    <th className="py-2 pr-3">Descripción</th>
                    <th className="py-2 pr-3">Monto</th>
                    <th className="py-2 pr-3">Recurrente</th>
                    <th className="py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.length === 0 ? (
                    <tr>
                      <td className="py-6 text-[#94A3B8]" colSpan={6}>
                        No hay gastos en este período.
                      </td>
                    </tr>
                  ) : (
                    gastos.map((g) => {
                      const meta = metaCategoria(g.categoria)
                      return (
                        <tr key={g.id} className="border-t border-white/10">
                          <td className="py-2 pr-3">{g.fecha}</td>
                          <td className="py-2 pr-3">
                            <span className="inline-flex rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold">
                              {meta.icono} {meta.label}
                            </span>
                          </td>
                          <td className="py-2 pr-3">{g.descripcion}</td>
                          <td className="py-2 pr-3">{money(g.monto, fiscal)}</td>
                          <td className="py-2 pr-3">
                            {g.recurrente
                              ? `Sí · ${FRECUENCIAS_GASTO.find((f) => f.id === g.frecuencia)?.label ?? ''}`
                              : 'No'}
                          </td>
                          <td className="py-2">
                            <button
                              className="text-xs font-semibold text-red-300 hover:underline"
                              type="button"
                              onClick={() => void onEliminar(g.id)}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === 'resultado' ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`rounded-md px-3 py-2 text-xs font-semibold ${
                    preset === p.id ? 'bg-[#6366F1] text-white' : 'bg-white/10 text-[#A5B4FC]'
                  }`}
                  onClick={() => {
                    setPreset(p.id)
                    const r = rangoContabilidad(p.id)
                    setDesde(r.desde)
                    setHasta(r.hasta)
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === 'personalizado' ? (
              <div className="flex flex-wrap gap-3">
                <input
                  className="h-10 rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm"
                  type="date"
                  value={desde}
                  onChange={(ev) => setDesde(ev.target.value)}
                />
                <input
                  className="h-10 rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm"
                  type="date"
                  value={hasta}
                  onChange={(ev) => setHasta(ev.target.value)}
                />
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Kpi titulo="💰 Ingresos totales" hint="Suma de ventas del período" valor={money(totales.ingresos, fiscal)} />
              <Kpi titulo="📦 Costo de mercadería (COGS)" hint="Suma de costos de ventas_items" valor={money(totales.cogs, fiscal)} />
              <Kpi titulo="🏭 Gastos operativos" hint="Suma de gastos del período" valor={money(totales.gastos, fiscal)} />
              <Kpi
                titulo="✅ Resultado neto"
                hint="Ingresos − COGS − Gastos"
                valor={money(totales.neto, fiscal)}
                color={totales.neto >= 0 ? COLOR_NET : COLOR_NEG}
              />
            </div>
            <section className="rounded-lg p-5" style={CARD}>
              <h2 className="text-lg font-semibold">Valor del stock</h2>
              <p className="mt-1 text-xs text-[#94A3B8]">Stock actual con cantidad mayor a cero, al costo y precio de venta.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Kpi
                  titulo="💰 Invertido en stock"
                  hint="Suma de stock × costo"
                  valor={money(valorStock.invertido, fiscal)}
                />
                <Kpi
                  titulo="📦 Valor de venta"
                  hint="Suma de stock × precio de venta"
                  valor={money(valorStock.valorVenta, fiscal)}
                />
                <Kpi
                  titulo="✅ Ganancia potencial"
                  hint="Valor de venta − invertido"
                  valor={money(valorStock.gananciaPotencial, fiscal)}
                  color={valorStock.gananciaPotencial >= 0 ? COLOR_NET : COLOR_NEG}
                />
              </div>
            </section>
            <section className="rounded-lg p-5" style={CARD}>
              <h2 className="text-lg font-semibold">Ingresos vs COGS vs Gastos (últimos 6 meses)</h2>
              <div className="mt-4 h-72">
                <ChartResponsive>
                  <BarChart data={serie6}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="label" {...propsEjeX('#F1F5F9')} />
                    <YAxis
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatoEjeCompacto(Number(v))}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0].payload as PuntoMes
                        return (
                          <ChartTooltipBox>
                            <p className="text-sm font-semibold">{p.label}</p>
                            <p className="mt-1 text-xs text-[#94A3B8]">Ingresos {money(p.ingresos, fiscal)}</p>
                            <p className="text-xs text-[#94A3B8]">COGS {money(p.cogs, fiscal)}</p>
                            <p className="text-xs text-[#94A3B8]">Gastos {money(p.gastos, fiscal)}</p>
                          </ChartTooltipBox>
                        )
                      }}
                    />
                    <Legend wrapperStyle={{ color: '#F1F5F9', fontSize: 12 }} />
                    <Bar dataKey="ingresos" name="Ingresos" stackId="a" fill={COLOR_ING} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="cogs" name="COGS" stackId="a" fill={COLOR_COGS} />
                    <Bar dataKey="gastos" name="Gastos" stackId="a" fill={COLOR_GAS} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartResponsive>
              </div>
            </section>
          </div>
        ) : null}

        {tab === 'ratios' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <RatioCard
              titulo="Margen bruto %"
              valor={`${ratios.margenBrutoPct.toFixed(1)}%`}
              color={colorSemaforo(semaforoMargenBruto(ratios.margenBrutoPct))}
              texto="Es lo que te queda de cada venta después de pagar la mercadería. Arriba del 50% es sano; debajo del 30% el negocio vive justo."
            />
            <RatioCard
              titulo="Margen neto %"
              valor={`${ratios.margenNetoPct.toFixed(1)}%`}
              color={colorSemaforo(semaforoMargenNeto(ratios.margenNetoPct))}
              texto="Lo que queda después de mercadería y gastos operativos. Más de 20% es fuerte; menos de 10% conviene revisar costos."
            />
            <RatioCard
              titulo="Punto de equilibrio"
              valor={money(ratios.puntoEquilibrio, fiscal)}
              texto={`Necesitás vender ${money(ratios.puntoEquilibrio, fiscal)} por mes para cubrir tus gastos, según el margen bruto actual.`}
            />
            <RatioCard
              titulo="ROI del negocio"
              valor={`${ratios.roiPct.toFixed(1)}%`}
              texto={`Por cada ${fiscal.simboloMoneda}100 invertidos (COGS + gastos), ${ratios.roiPct >= 0 ? 'ganás' : 'perdés'} ${money(Math.abs((ratios.roiPct / 100) * 100), fiscal)}.`}
            />
            <RatioCard
              titulo="Días de inventario"
              valor={`${Math.round(ratios.diasInventario)} días`}
              texto={`Tu stock actual dura ${Math.round(ratios.diasInventario)} días al ritmo de costo de ventas de este período.`}
            />
            <RatioCard
              titulo="Ticket promedio"
              valor={money(ratios.ticket, fiscal)}
              texto="Promedio de cada venta del período. Si baja, mirá mix de productos, descuentos o canal."
            />
          </div>
        ) : null}

        {tab === 'flujo' ? (
          <div className="space-y-6">
            {alertaProy ? (
              <p className="rounded-xl bg-amber-500/15 px-3 py-3 text-sm text-amber-100">
                ⚠️ Tu flujo de caja proyectado para {alertaProy.label} es negativo. Revisá tus gastos o aumentá tus
                ventas.
              </p>
            ) : null}
            <section className="rounded-lg p-5" style={CARD}>
              <h2 className="text-lg font-semibold">Últimos 6 meses</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-[#94A3B8]">
                    <tr>
                      <th className="py-2 pr-3">Mes</th>
                      <th className="py-2 pr-3">Ingresos</th>
                      <th className="py-2 pr-3">COGS</th>
                      <th className="py-2 pr-3">Gastos</th>
                      <th className="py-2 pr-3">Resultado</th>
                      <th className="py-2">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flujoHist.map((p) => (
                      <tr key={p.clave} className="border-t border-white/10">
                        <td className="py-2 pr-3">{p.label}</td>
                        <td className="py-2 pr-3">{money(p.ingresos, fiscal)}</td>
                        <td className="py-2 pr-3">{money(p.cogs, fiscal)}</td>
                        <td className="py-2 pr-3">{money(p.gastos, fiscal)}</td>
                        <td className="py-2 pr-3" style={{ color: p.resultado >= 0 ? COLOR_NET : COLOR_NEG }}>
                          {money(p.resultado, fiscal)}
                        </td>
                        <td className="py-2">{money(p.acumulado, fiscal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="rounded-lg p-5" style={CARD}>
              <h2 className="text-lg font-semibold">Acumulado y proyección (3 meses)</h2>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Si la línea sube, el negocio está creciendo. Si baja, hay que revisar los gastos. La punteada es el
                promedio de los últimos 3 meses.
              </p>
              <div className="mt-4 h-72">
                <ChartResponsive>
                  <LineChart data={chartFlujo}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="label" {...propsEjeX('#F1F5F9')} />
                    <YAxis
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatoEjeCompacto(Number(v))}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0].payload as { label: string; historico: number | null; proyeccion: number | null }
                        const v = p.historico ?? p.proyeccion ?? 0
                        return (
                          <ChartTooltipBox>
                            <p className="text-sm font-semibold">{p.label}</p>
                            <p className="mt-1 text-xs text-[#94A3B8]">Acumulado {money(v, fiscal)}</p>
                          </ChartTooltipBox>
                        )
                      }}
                    />
                    <Line type="monotone" dataKey="historico" name="Acumulado" stroke={COLOR_ING} strokeWidth={2} dot={false} connectNulls={false} />
                    <Line
                      type="monotone"
                      dataKey="proyeccion"
                      name="Proyección"
                      stroke={COLOR_ING}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ChartResponsive>
              </div>
            </section>
          </div>
        ) : null}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center">
          <form
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
            style={{ background: '#1A2F4A' }}
            onSubmit={(ev) => void onGuardarGasto(ev)}
          >
            <h3 className="text-lg font-bold text-[#F1F5F9]">Nuevo gasto</h3>
            <label className="mt-4 block text-sm font-medium text-[#94A3B8]">
              Categoría
              <select
                className="mt-1 h-10 w-full rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9]"
                value={catNueva}
                onChange={(ev) => setCatNueva(ev.target.value as CategoriaGasto)}
              >
                {CATEGORIAS_GASTO.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icono} {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm font-medium text-[#94A3B8]">
              Descripción
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9]"
                value={descNueva}
                onChange={(ev) => setDescNueva(ev.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-[#94A3B8]">
              Monto
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9]"
                inputMode="decimal"
                value={montoNuevo}
                onChange={(ev) => setMontoNuevo(ev.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-[#94A3B8]">
              Fecha
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9]"
                type="date"
                value={fechaNueva}
                onChange={(ev) => setFechaNueva(ev.target.value)}
              />
            </label>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-[#F1F5F9]">¿Es recurrente?</p>
              <button
                type="button"
                role="switch"
                aria-checked={recurrente}
                className={`relative h-7 w-12 shrink-0 rounded-full ${recurrente ? 'bg-[#6366F1]' : 'bg-white/20'}`}
                onClick={() => setRecurrente((v) => !v)}
              >
                <span
                  className="absolute top-[3px] left-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform"
                  style={{ transform: recurrente ? 'translate3d(20px, 0, 0)' : 'translate3d(0, 0, 0)' }}
                />
              </button>
            </div>
            {recurrente ? (
              <label className="mt-3 block text-sm font-medium text-[#94A3B8]">
                Frecuencia
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9]"
                  value={frecuencia}
                  onChange={(ev) => setFrecuencia(ev.target.value as FrecuenciaGasto)}
                >
                  {FRECUENCIAS_GASTO.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button className={btnPrimary} type="submit" disabled={guardando}>
                {guardando ? 'GUARDANDO…' : 'Guardar'}
              </button>
              <button
                className="h-11 rounded-lg border border-[rgba(99,102,241,0.35)] px-4 text-sm font-semibold text-[#A5B4FC]"
                type="button"
                onClick={() => setModal(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

function Kpi({
  titulo,
  hint,
  valor,
  color,
}: {
  titulo: string
  hint: string
  valor: string
  color?: string
}) {
  return (
    <div className="rounded-lg p-4" style={CARD}>
      <p className="text-sm font-medium text-[#F1F5F9]">{titulo}</p>
      <p className="mt-1 text-xs text-[#94A3B8]">{hint}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: color ?? '#F1F5F9' }}>
        {valor}
      </p>
    </div>
  )
}

function RatioCard({
  titulo,
  valor,
  texto,
  color,
}: {
  titulo: string
  valor: string
  texto: string
  color?: string
}) {
  return (
    <div className="rounded-lg p-5" style={CARD}>
      <p className="text-sm font-medium text-[#94A3B8]">{titulo}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: color ?? '#F1F5F9' }}>
        {valor}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">{texto}</p>
    </div>
  )
}
