import { useEffect, useMemo, useRef, useState } from 'react'
import { formatoARS } from '../lib/productos'
import {
  etiquetaCombo,
  precioVarianteOBase,
  variantePorSeleccion,
  type AtributoFila,
  type VarianteFila,
} from '../lib/variantes'
import type { ProductoFila } from '../lib/productos'
import { etiquetaLoteOpcion, type LoteFila } from '../lib/lotes'

export function VarianteChipsPicker({
  producto,
  variantes,
  stockPorId,
  clavesVisibles,
  atributosCatalogo,
  exigirStock,
  etiquetaAccion,
  onElegir,
  onCancelar,
  cargarLotes,
}: {
  producto: ProductoFila
  variantes: VarianteFila[]
  stockPorId: Map<string, number>
  clavesVisibles: string[]
  atributosCatalogo?: AtributoFila[]
  exigirStock: boolean
  etiquetaAccion: string
  onElegir: (
    variante: VarianteFila | null,
    sel: Record<string, string>,
    extra?: { loteId: string | null; lotes: LoteFila[] },
  ) => void
  onCancelar: () => void
  cargarLotes?: (productoId: string, varianteId: string | null) => Promise<LoteFila[]>
}) {
  const [sel, setSel] = useState<Record<string, string>>({})
  const [lotes, setLotes] = useState<LoteFila[]>([])
  const [loteId, setLoteId] = useState<string | null>(null)

  const grupos = useMemo(() => {
    const permitidas = new Set(clavesVisibles)
    if (variantes.length > 0) {
      const map = new Map<string, string[]>()
      for (const v of variantes) {
        for (const [k, val] of Object.entries(v.atributos)) {
          if (permitidas.size > 0 && !permitidas.has(k)) continue
          const arr = map.get(k) ?? []
          if (!arr.includes(val)) arr.push(val)
          map.set(k, arr)
        }
      }
      if (map.size === 0) {
        for (const v of variantes) {
          for (const [k, val] of Object.entries(v.atributos)) {
            const arr = map.get(k) ?? []
            if (!arr.includes(val)) arr.push(val)
            map.set(k, arr)
          }
        }
      }
      return [...map.entries()]
    }
    const attrs = (atributosCatalogo ?? []).filter(
      (a) => a.activoVentas && (permitidas.size === 0 || permitidas.has(a.nombre)),
    )
    return attrs.map((a) => [a.nombre, a.valores] as [string, string[]])
  }, [variantes, clavesVisibles, atributosCatalogo])

  const keys = grupos.map(([k]) => k)
  const completa = keys.length > 0 && keys.every((k) => Boolean(sel[k]))
  const match = completa ? variantePorSeleccion(variantes, sel) : null
  const stock = match ? (stockPorId.get(match.id) ?? 0) : completa && variantes.length > 0 ? 0 : null
  const precio = precioVarianteOBase(match?.precioVenta, producto.precio_venta)
  const costo = match && match.costo != null && Number.isFinite(match.costo) ? match.costo : producto.costo

  useEffect(() => {
    console.log('[variantes] selección de atributos', {
      productoId: producto.id,
      sel,
      completa,
      match: match
        ? { id: match.id, atributos: match.atributos, precioVenta: match.precioVenta }
        : null,
      precioQueSeUsaria: precio,
      variantes: variantes.map((v) => ({
        id: v.id,
        atributos: v.atributos,
        precioVenta: v.precioVenta,
      })),
    })
  }, [sel, completa, match, precio, producto.id, variantes])

  function chipPosible(nombre: string, val: string) {
    if (variantes.length === 0) return true
    const trial = { ...sel, [nombre]: val }
    return variantes.some((v) => Object.entries(trial).every(([k, x]) => v.atributos[k] === x))
  }

  function chipSinStock(nombre: string, val: string) {
    if (!exigirStock || variantes.length === 0) return false
    const trial = { ...sel, [nombre]: val }
    return !variantes.some((v) => {
      const ok = Object.entries(trial).every(([k, x]) => v.atributos[k] === x)
      return ok && (stockPorId.get(v.id) ?? 0) > 0
    })
  }

  const puedeConfirmar = completa && (variantes.length === 0 || match != null)
  const loteSel = lotes.find((l) => l.id === loteId) ?? null

  const conLotes = Boolean(cargarLotes)
  const cargarLotesRef = useRef(cargarLotes)
  cargarLotesRef.current = cargarLotes

  useEffect(() => {
    const fn = cargarLotesRef.current
    if (!fn || !completa) {
      setLotes([])
      setLoteId(null)
      return
    }
    let vivo = true
    void fn(producto.id, match?.id ?? null).then((lista) => {
      if (!vivo) return
      setLotes(lista)
      setLoteId(lista[0]?.id ?? null)
    })
    return () => {
      vivo = false
    }
  }, [completa, match?.id, producto.id, conLotes])

  return (
    <div className="mt-3 rounded-md border border-[#E2E8F0] p-3">
      <p className="text-sm font-semibold text-[#1A2F4A]">{producto.nombre}</p>
      {grupos.map(([nombre, valores]) => (
        <div key={nombre} className="mt-3">
          <p className="text-xs font-medium text-[#4A5568]">{nombre}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {valores.map((val) => {
              const on = sel[nombre] === val
              const posible = chipPosible(nombre, val)
              const sinStock = chipSinStock(nombre, val)
              return (
                <button
                  key={val}
                  type="button"
                  disabled={!posible}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    on && sinStock
                      ? 'bg-[#DC2626] text-white'
                      : on
                        ? 'bg-[#6366F1] text-white'
                        : !posible
                          ? 'cursor-not-allowed bg-[#E2E8F0] text-[#94A3B8]'
                          : sinStock
                            ? 'border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
                            : 'border border-[#E2E8F0] bg-white text-[#1A2F4A]'
                  }`}
                  onClick={() => {
                    if (!posible) return
                    setSel((prev) => ({ ...prev, [nombre]: val }))
                  }}
                >
                  {sinStock ? `⚠️ ${on ? `${val} ✓` : val}` : on ? `${val} ✓` : val}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {keys.length === 0 ? (
        <p className="mt-3 text-xs text-[#4A5568]">
          {variantes.length === 0
            ? 'Este producto no tiene variantes guardadas.'
            : 'No hay atributos activos en ventas para este producto.'}
        </p>
      ) : !completa ? (
        <p className="mt-3 text-xs text-[#4A5568]">Seleccioná todos los atributos para continuar.</p>
      ) : (
        <div className="mt-3 text-sm text-[#1A2F4A]">
          {lotes.length > 0 ? (
            <label className="mb-2 block text-xs text-[#4A5568]">
              Lote
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 py-2 text-sm text-[#1A2F4A]"
                value={loteId ?? ''}
                onChange={(ev) => setLoteId(ev.target.value || null)}
              >
                {lotes.map((lote) => (
                  <option key={lote.id} value={lote.id}>
                    {etiquetaLoteOpcion(lote)}
                  </option>
                ))}
              </select>
              {loteSel ? (
                <p className="mt-1">Stock del lote: {loteSel.stock} {loteSel.stock === 1 ? 'unidad' : 'unidades'}</p>
              ) : null}
            </label>
          ) : null}
          <p>
            Stock disponible: {stock ?? 0} {(stock ?? 0) === 1 ? 'unidad' : 'unidades'}
            {stock != null && stock <= 0 ? ' ⚠️' : ''}
          </p>
          {exigirStock ? <p>Precio: {formatoARS(precio)}</p> : <p>Costo: {formatoARS(costo)}</p>}
          {match ? <p className="text-xs text-[#4A5568]">{etiquetaCombo(match.atributos)}</p> : null}
          {!match && variantes.length > 0 ? (
            <p className="mt-2 text-xs text-[#EA580C]">Esa combinación no se vende.</p>
          ) : (
            <button
              className="mt-2 h-10 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
              type="button"
              disabled={!puedeConfirmar}
              onClick={() => {
                console.log('[variantes] confirmar picker', {
                  match,
                  sel,
                  precio,
                })
                onElegir(match, sel, { loteId, lotes })
              }}
            >
              {etiquetaAccion}
            </button>
          )}
        </div>
      )}
      <button className="mt-2 text-xs text-[#4A5568]" type="button" onClick={onCancelar}>
        Cancelar
      </button>
    </div>
  )
}
