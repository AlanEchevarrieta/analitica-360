import { useState } from 'react'
import { formatoARS } from '../lib/productos'
import { anularVenta, formatoFechaVenta, type VentaFila } from '../lib/ventas'
import { requireSupabase } from '../lib/supabase'

export function AnularVentaModal({
  venta,
  onCerrar,
  onOk,
}: {
  venta: VentaFila
  onCerrar: () => void
  onOk: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setError(null)
    if (!motivo.trim()) {
      setError('El motivo de anulación es obligatorio')
      return
    }
    setEnviando(true)
    const fallo = await anularVenta(requireSupabase(), venta.id, motivo.trim())
    setEnviando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    onOk()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[440px] rounded-lg bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <h2 className="text-xl font-bold text-[#1A2F4A]">¿Confirmar anulación de esta venta?</h2>
        <div className="mt-4 rounded-md bg-[#EEF2F6] px-3 py-3 text-sm text-[#1A2F4A]">
          <p>Fecha: {formatoFechaVenta(venta.fecha)}</p>
          <p className="mt-1">Productos: {venta.productos || '—'}</p>
          <p className="mt-1 font-semibold">Total: {formatoARS(venta.total)}</p>
        </div>
        <label className="mt-4 block text-sm font-medium text-[#4A5568]">
          Motivo de anulación
          <textarea
            className="mt-1.5 min-h-[88px] w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 py-2 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]"
            value={motivo}
            onChange={(ev) => setMotivo(ev.target.value)}
          />
        </label>
        {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex gap-2">
          <button
            className="h-11 flex-1 rounded-md border border-[#E2E8F0] text-sm font-semibold text-[#4A5568]"
            type="button"
            onClick={onCerrar}
          >
            Cancelar
          </button>
          <button
            className="h-11 flex-1 rounded-md bg-[#DC2626] text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
            type="button"
            disabled={enviando}
            onClick={() => void confirmar()}
          >
            {enviando ? 'ANULANDO…' : 'Confirmar anulación'}
          </button>
        </div>
      </div>
    </div>
  )
}
