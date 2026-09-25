import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { AppNav } from '../components/AppNav'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { Breadcrumb, PageSkeleton, btnPrimary, cardShell } from '../components/listado'
import { mostrarToast } from '../lib/consulta'
import { fechaHoyAR } from '../lib/analytics'
import { formatoARS } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import {
  FORMAS_PAGO,
  cobrarSaldoVenta,
  etiquetaEstadoCobro,
  etiquetaFormaPago,
  formatoFechaVenta,
  obtenerVenta,
  type VentaFicha,
} from '../lib/ventas'
import { theme } from '../theme'

const inputClass =
  'mt-1.5 h-11 w-full rounded-lg border border-[rgba(99,102,241,0.3)] bg-white/5 px-3 text-sm text-[#F1F5F9] outline-none focus:border-[#6366F1]'

export function VentaFichaPage() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [ficha, setFicha] = useState<VentaFicha | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [monto, setMonto] = useState('')
  const [forma, setForma] = useState('efectivo')
  const [fecha, setFecha] = useState(fechaHoyAR)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    const { data, error: fallo } = await obtenerVenta(requireSupabase(), id)
    setCargando(false)
    if (fallo || !data) {
      setError(fallo ?? 'No se encontró la venta')
      setFicha(null)
      return
    }
    setError(null)
    setFicha(data)
    setMonto(String(data.saldoPendiente))
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function confirmarCobro() {
    if (!ficha) return
    const n = Number(monto.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) {
      mostrarToast('El monto tiene que ser mayor a 0', 'error')
      return
    }
    setGuardando(true)
    const fallo = await cobrarSaldoVenta(requireSupabase(), {
      id: ficha.id,
      monto: n,
      formaPago: forma,
      fecha,
    })
    setGuardando(false)
    if (fallo) {
      mostrarToast(fallo, 'error')
      return
    }
    mostrarToast('Saldo cobrado', 'ok')
    setModal(false)
    void cargar()
  }

  if (!perfil) return null
  const badge = ficha ? etiquetaEstadoCobro(ficha.estadoCobro, ficha.esSenia) : null

  return (
    <div
      className="relative min-h-dvh"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <ParticleNetwork />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <AppNav />
        <Breadcrumb
          items={[
            { label: 'Ventas', to: '/ventas' },
            { label: ficha?.numeroVenta ? `#${ficha.numeroVenta}` : 'Venta' },
          ]}
        />
        {cargando ? <PageSkeleton /> : null}
        {error ? <p className="mt-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        {ficha && !cargando ? (
          <div className="mt-4 space-y-4">
            <div className="p-5" style={cardShell}>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                  {ficha.numeroVenta ?? 'Venta'}
                </h1>
                {badge ? (
                  <span
                    className="rounded-full px-2.5 py-[3px] text-xs font-semibold"
                    style={{ color: badge.fg, background: badge.bg }}
                  >
                    {badge.texto}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                {formatoFechaVenta(ficha.fecha)}
                {ficha.cliente ? ` · ${ficha.cliente}` : ''}
                {` · ${etiquetaFormaPago(ficha.forma_pago)}`}
              </p>
              {ficha.cargadoPor || ficha.ubicacion ? (
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {ficha.cargadoPor ? `Cargada por ${ficha.cargadoPor}` : ''}
                  {ficha.cargadoPor && ficha.ubicacion ? ' · ' : ''}
                  {ficha.ubicacion ? ficha.ubicacion : ''}
                </p>
              ) : null}
              <p className="mt-3 text-lg font-bold text-[#4ADE80]">{formatoARS(ficha.total)}</p>
              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    <th className="py-2 pr-3 font-medium">Producto</th>
                    <th className="py-2 pr-3 font-medium">Cant.</th>
                    <th className="py-2 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.items.map((i, idx) => (
                    <tr key={`${i.nombre}-${idx}`} className="border-t border-white/10">
                      <td className="py-2 pr-3">{i.nombre}</td>
                      <td className="py-2 pr-3">{i.cantidad}</td>
                      <td className="py-2">{formatoARS(i.cantidad * i.precioUnitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {ficha.esSenia ? (
              <div className="p-5" style={cardShell}>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  💰 Estado del cobro
                </h2>
                <p className="mt-3 text-sm" style={{ color: 'var(--text)' }}>
                  Seña cobrada: {formatoARS(ficha.montoSenia)} ✅
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text)' }}>
                  Saldo pendiente: {formatoARS(ficha.saldoPendiente)} {ficha.saldoPendiente > 0 ? '⏳' : '✅'}
                </p>
                {ficha.estadoCobro !== 'pagado' && ficha.saldoPendiente > 0 ? (
                  <button className={`${btnPrimary} mt-4`} type="button" onClick={() => setModal(true)}>
                    Cobrar saldo pendiente
                  </button>
                ) : (
                  <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Saldo cobrado
                    {ficha.fechaCobroSaldo ? ` · ${formatoFechaVenta(ficha.fechaCobroSaldo)}` : ''}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        <Link className="mt-6 block text-center text-sm text-[#A5B4FC]" to="/ventas">
          Volver al listado
        </Link>
        {error && !ficha && !cargando ? (
          <button className="mx-auto mt-3 block text-sm text-[#A5B4FC]" type="button" onClick={() => navigate('/ventas')}>
            Ir a ventas
          </button>
        ) : null}
      </div>

      {modal && ficha ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center">
          <div className="w-full max-w-md rounded-lg p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]" style={{ background: '#1A2F4A' }}>
            <h3 className="text-lg font-bold text-[#F1F5F9]">Cobrar saldo pendiente</h3>
            <label className="mt-4 block text-sm font-medium text-[#94A3B8]">
              Monto a cobrar
              <input
                className={inputClass}
                inputMode="decimal"
                value={monto}
                onChange={(ev) => setMonto(ev.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-[#94A3B8]">
              Forma de pago
              <select className={inputClass} value={forma} onChange={(ev) => setForma(ev.target.value)}>
                {FORMAS_PAGO.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm font-medium text-[#94A3B8]">
              Fecha de cobro
              <input className={inputClass} type="date" value={fecha} onChange={(ev) => setFecha(ev.target.value)} />
            </label>
            <div className="mt-5 flex gap-2">
              <button className={btnPrimary} type="button" disabled={guardando} onClick={() => void confirmarCobro()}>
                {guardando ? 'Guardando…' : 'Confirmar cobro'}
              </button>
              <button
                className="h-11 rounded-lg border border-[rgba(99,102,241,0.35)] px-4 text-sm font-semibold text-[#A5B4FC]"
                type="button"
                onClick={() => setModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
