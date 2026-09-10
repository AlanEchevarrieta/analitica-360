import { useEffect, useState } from 'react'
import { ajustarStock, TIPOS_AJUSTE, type TipoAjusteStock } from '../lib/stock'
import { requireSupabase } from '../lib/supabase'
import { etiquetaCombo, listarVariantesProducto, stockPorVariante, type VarianteFila } from '../lib/variantes'

const SIN_VARIANTE = '__none__'

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
  const [variantes, setVariantes] = useState<VarianteFila[]>([])
  const [stocks, setStocks] = useState<Map<string, number>>(new Map())
  const [seleccion, setSeleccion] = useState(varianteId ?? '')
  const [cargandoVars, setCargandoVars] = useState(!varianteId)

  useEffect(() => {
    if (varianteId) {
      setSeleccion(varianteId)
      setCargandoVars(false)
      return
    }
    setCargandoVars(true)
    void listarVariantesProducto(requireSupabase(), producto.id).then(async (res) => {
      const activas = (res.filas ?? []).filter((v) => v.activo)
      setVariantes(activas)
      if (activas.length > 0) {
        setStocks(await stockPorVariante(requireSupabase(), activas.map((v) => v.id)))
        setSeleccion('')
      } else {
        setSeleccion(SIN_VARIANTE)
      }
      setCargandoVars(false)
    })
  }, [producto.id, varianteId])

  const pideVariante = !varianteId && variantes.length > 0
  const stockMostrar =
    seleccion && seleccion !== SIN_VARIANTE
      ? (stocks.get(seleccion) ?? 0)
      : producto.stock

  async function confirmar() {
    setError(null)
    if (pideVariante && !seleccion) {
      setError('Elegí a qué variante querés ajustar el stock')
      return
    }
    const n = Number.parseInt(cantidad, 10)
    if (!Number.isFinite(n) || n <= 0) {
      setError('La cantidad tiene que ser un número positivo')
      return
    }
    if (!motivo.trim()) {
      setError('El motivo es obligatorio')
      return
    }
    const varianteElegida =
      varianteId || (seleccion && seleccion !== SIN_VARIANTE ? seleccion : null)
    setEnviando(true)
    const fallo = await ajustarStock(requireSupabase(), {
      productoId: producto.id,
      tipo,
      cantidad: n,
      motivo: motivo.trim(),
      varianteId: varianteElegida,
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
        {pideVariante ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-[#1A2F4A]">
            Este producto tiene variantes. ¿A qué variante querés ajustar el stock?
          </div>
        ) : null}
        {pideVariante ? (
          <label className="mt-4 block text-sm font-medium text-[#4A5568]">
            Variante
            <select
              className="mt-1.5 h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]"
              value={seleccion}
              onChange={(ev) => setSeleccion(ev.target.value)}
            >
              <option value="">Elegí una opción</option>
              <option value={SIN_VARIANTE}>Sin variante específica</option>
              {variantes.map((v) => (
                <option key={v.id} value={v.id}>
                  {etiquetaCombo(v.atributos)} ({stocks.get(v.id) ?? 0} u)
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <p className="mt-2 text-sm text-[#4A5568]">
          Stock actual{pideVariante && seleccion && seleccion !== SIN_VARIANTE ? ' de la variante' : ''}:{' '}
          {cargandoVars ? '…' : `${stockMostrar} unidades`}
        </p>
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
            disabled={enviando || cargandoVars}
            onClick={() => void confirmar()}
          >
            {enviando ? 'GUARDANDO…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
