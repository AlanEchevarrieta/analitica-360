import { useMemo, useState } from 'react'
import { formatoARS } from '../lib/productos'
import { etiquetaCombo, type AtributoFila, type VarianteFila } from '../lib/variantes'
import type { ProductoFila } from '../lib/productos'

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
}: {
  producto: ProductoFila
  variantes: VarianteFila[]
  stockPorId: Map<string, number>
  clavesVisibles: string[]
  atributosCatalogo?: AtributoFila[]
  exigirStock: boolean
  etiquetaAccion: string
  onElegir: (variante: VarianteFila | null, sel: Record<string, string>) => void
  onCancelar: () => void
}) {
  const [sel, setSel] = useState<Record<string, string>>({})

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
      return [...map.entries()]
    }
    const attrs = (atributosCatalogo ?? []).filter(
      (a) => a.activoVentas && (permitidas.size === 0 || permitidas.has(a.nombre)),
    )
    return attrs.map((a) => [a.nombre, a.valores] as [string, string[]])
  }, [variantes, clavesVisibles, atributosCatalogo])

  const keys = grupos.map(([k]) => k)
  const completa = keys.length > 0 && keys.every((k) => Boolean(sel[k]))
  const matches = completa
    ? variantes.filter((v) => keys.every((k) => v.atributos[k] === sel[k]))
    : []
  const match =
    matches.find((v) => (stockPorId.get(v.id) ?? 0) > 0) ?? matches[0] ?? null
  const stock = match ? (stockPorId.get(match.id) ?? 0) : completa && !match ? 0 : null
  const precio =
    match && match.precioVenta != null ? match.precioVenta : producto.precio_venta
  const costo = match && match.costo != null ? match.costo : producto.costo

  function chipTieneStock(nombre: string, val: string) {
    if (variantes.length === 0) return true
    const trial = { ...sel, [nombre]: val }
    return variantes.some((v) => {
      const ok = Object.entries(trial).every(([k, x]) => v.atributos[k] === x)
      return ok && (stockPorId.get(v.id) ?? 0) > 0
    })
  }

  const puedeConfirmar = completa && (!exigirStock || (match != null && (stock ?? 0) > 0 && match.activo))
  const bloqueadoVenta = exigirStock && completa && (match == null || (stock ?? 0) <= 0)

  return (
    <div className="mt-3 rounded-md border border-[#E2E8F0] p-3">
      <p className="text-sm font-semibold text-[#1A2F4A]">{producto.nombre}</p>
      {grupos.map(([nombre, valores]) => (
        <div key={nombre} className="mt-3">
          <p className="text-xs font-medium text-[#4A5568]">{nombre}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {valores.map((val) => {
              const on = sel[nombre] === val
              const sinStock = exigirStock && !chipTieneStock(nombre, val)
              return (
                <button
                  key={val}
                  type="button"
                  disabled={sinStock}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    on
                      ? 'bg-[#6366F1] text-white'
                      : sinStock
                        ? 'cursor-not-allowed bg-[#E2E8F0] text-[#94A3B8]'
                        : 'border border-[#E2E8F0] bg-white text-[#1A2F4A]'
                  }`}
                  onClick={() => {
                    if (sinStock) return
                    setSel((prev) => ({ ...prev, [nombre]: val }))
                  }}
                >
                  {on ? `${val} ✓` : val}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {keys.length === 0 ? (
        <p className="mt-3 text-xs text-[#4A5568]">No hay atributos activos en ventas para este producto.</p>
      ) : !completa ? (
        <p className="mt-3 text-xs text-[#4A5568]">Seleccioná todos los atributos para continuar.</p>
      ) : (
        <div className="mt-3 text-sm text-[#1A2F4A]">
          <p>
            Stock actual: {stock}
            {stock != null && stock <= 0 ? ' ⚠️' : ''}
          </p>
          {exigirStock ? <p>Precio: {formatoARS(precio)}</p> : <p>Costo: {formatoARS(costo)}</p>}
          {match ? <p className="text-xs text-[#4A5568]">{etiquetaCombo(match.atributos)}</p> : null}
          {bloqueadoVenta ? (
            <p className="mt-2 text-xs text-[#EA580C]">Esa combinación no tiene stock.</p>
          ) : (
            <button
              className="mt-2 h-10 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
              type="button"
              disabled={!puedeConfirmar && exigirStock}
              onClick={() => onElegir(match, sel)}
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
