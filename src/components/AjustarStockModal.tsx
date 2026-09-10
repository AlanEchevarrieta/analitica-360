import { useState } from 'react'
import { ajustarStock, TIPOS_AJUSTE, type TipoAjusteStock } from '../lib/stock'
import { requireSupabase } from '../lib/supabase'

export function AjustarStockModal({
  producto,
  varianteId,
  empresaId,
  onCerrar,
  onOk,
}: {
  producto: { id: string; nombre: string; stock: number }
  varianteId?: string | null
  empresaId?: string
  onCerrar: () => void
  onOk: () => void
}) {
  const [tipo, setTipo] = useState<TipoAjusteStock>('ajuste_positivo')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setError(null)
    const n = Number.parseInt(cantidad, 10)
    if (!Number.isFinite(n) || n <= 0) {
      setError('La cantidad tiene que ser un número positivo')
      return
    }
    if (!motivo.trim()) {
      setError('El motivo es obligatorio')
      return
    }
    setEnviando(true)
    const fallo = await ajustarStock(requireSupabase(), {
      productoId: producto.id,
      tipo,
      cantidad: n,
      motivo: motivo.trim(),
      varianteId: varianteId ?? null,
      empresaId,
    })
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
        <h2 className="text-xl font-bold text-[#1A2F4A]">Ajustar stock de {producto.nombre}</h2>
        <p className="mt-2 text-sm text-[#4A5568]">Stock actual: {producto.stock} unidades</p>
        <p className="mt-4 text-sm font-medium text-[#4A5568]">Tipo de ajuste</p>
        {TIPOS_AJUSTE.map((op) => (
          <label key={op.id} className="mt-2 flex items-start gap-2 text-sm text-[#1A2F4A]">
            <input
              type="radio"
              className="mt-1 accent-[#6366F1]"
              name="tipo-ajuste"
              checked={tipo === op.id}
              onChange={() => setTipo(op.id)}
            />
            {op.label}
          </label>
        ))}
        <label className="mt-4 block text-sm font-medium text-[#4A5568]">
          Cantidad a ajustar
          <input
            className="mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]"
            inputMode="numeric"
            value={cantidad}
            onChange={(ev) => setCantidad(ev.target.value)}
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-[#4A5568]">
          Motivo
          <input
            className="mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]"
            value={motivo}
            onChange={(ev) => setMotivo(ev.target.value)}
          />
        </label>
        {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex gap-2">
          <button
            className="h-11 flex-1 rounded-md border border-[#E2E8F0] text-sm font-semibold text-[#4A5568]"
            type="button"
            onClick={onCerrar}
          >
            Cancelar
          </button>
          <button
            className="h-11 flex-1 rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
            type="button"
            disabled={enviando}
            onClick={() => void confirmar()}
          >
            {enviando ? 'GUARDANDO…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
