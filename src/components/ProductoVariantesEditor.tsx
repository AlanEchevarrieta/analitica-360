import { useEffect, useImperativeHandle, useMemo, useState, forwardRef } from 'react'
import {
  combinacionesDe,
  etiquetaCombo,
  guardarVariantesProducto,
  listarAtributos,
  listarVariantesProducto,
  mismaCombinacion,
  skuAutomatico,
  type AtributoFila,
  type VarianteFila,
} from '../lib/variantes'
import { requireSupabase } from '../lib/supabase'

const inputClass =
  'h-9 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-2 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1]'

export type VarianteDraft = {
  id?: string
  sku: string
  atributos: Record<string, string>
  precio: string
  costo: string
  activo: boolean
  skuManual: boolean
}

export type ProductoVariantesHandle = {
  persistir: (productoId: string) => Promise<string | null>
}

export const ProductoVariantesEditor = forwardRef<
  ProductoVariantesHandle,
  {
    productoId: string | null
    empresaId: string
    nombreProducto: string
    precioBase: number
    costoBase: number | null
  }
>(function ProductoVariantesEditor(
  { productoId, empresaId, nombreProducto, precioBase, costoBase },
  ref,
) {
  const [atributos, setAtributos] = useState<AtributoFila[]>([])
  const [elegidos, setElegidos] = useState<string[]>([])
  const [drafts, setDrafts] = useState<VarianteDraft[]>([])
  const [existentes, setExistentes] = useState<VarianteFila[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    void listarAtributos(requireSupabase()).then((res) => {
      if (!res.error) setAtributos(res.filas)
    })
  }, [])

  useEffect(() => {
    if (!productoId) return
    void listarVariantesProducto(requireSupabase(), productoId).then((res) => {
      if (res.error || res.filas.length === 0) return
      setExistentes(res.filas)
      const keys = [...new Set(res.filas.flatMap((v) => Object.keys(v.atributos)))]
      setElegidos(keys)
      setDrafts(
        res.filas.map((v) => ({
          id: v.id,
          sku: v.sku,
          atributos: v.atributos,
          precio: v.precioVenta == null ? '' : String(v.precioVenta),
          costo: v.costo == null ? '' : String(v.costo),
          activo: v.activo,
          skuManual: Boolean(v.sku),
        })),
      )
    })
  }, [productoId])

  const attrsActivos = useMemo(
    () => atributos.filter((a) => elegidos.includes(a.nombre)),
    [atributos, elegidos],
  )

  useEffect(() => {
    if (attrsActivos.length === 0) {
      if (existentes.length === 0) setDrafts([])
      return
    }
    const combos = combinacionesDe(attrsActivos).slice(0, 200)
    setDrafts((prev) =>
      combos.map((atributosCombo) => {
        const prevMatch = prev.find((d) => mismaCombinacion(d.atributos, atributosCombo))
        if (prevMatch) return { ...prevMatch, atributos: atributosCombo }
        const ex = existentes.find((e) => mismaCombinacion(e.atributos, atributosCombo))
        const sku = skuAutomatico(nombreProducto, atributosCombo)
        return {
          id: ex?.id,
          sku: ex?.sku || sku,
          atributos: atributosCombo,
          precio: ex?.precioVenta != null ? String(ex.precioVenta) : '',
          costo: ex?.costo != null ? String(ex.costo) : '',
          activo: ex?.activo ?? true,
          skuManual: Boolean(ex?.sku),
        }
      }),
    )
  }, [attrsActivos, nombreProducto, existentes])

  useEffect(() => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.skuManual ? d : { ...d, sku: skuAutomatico(nombreProducto, d.atributos) },
      ),
    )
  }, [nombreProducto])

  useImperativeHandle(
    ref,
    () => ({
      persistir: (pid: string) =>
        drafts.length === 0
          ? Promise.resolve(null)
          : guardarVariantesProducto(requireSupabase(), {
              productoId: pid,
              empresaId,
              variantes: drafts.map((d) => ({
                id: d.id,
                sku: d.sku,
                atributos: d.atributos,
                precioVenta: d.precio.trim() === '' ? precioBase : Number(d.precio.replace(',', '.')) || precioBase,
                costo: d.costo.trim() === '' ? costoBase : Number(d.costo.replace(',', '.')) || costoBase,
                activo: d.activo,
              })),
            }),
    }),
    [drafts, empresaId, precioBase, costoBase],
  )

  async function guardar() {
    if (!productoId) {
      setError('Guardá el producto primero y después las variantes')
      return
    }
    setError(null)
    setOk(null)
    setGuardando(true)
    const fallo = await guardarVariantesProducto(requireSupabase(), {
      productoId,
      empresaId,
      variantes: drafts.map((d) => ({
        id: d.id,
        sku: d.sku,
        atributos: d.atributos,
        precioVenta: d.precio.trim() === '' ? precioBase : Number(d.precio.replace(',', '.')) || precioBase,
        costo: d.costo.trim() === '' ? costoBase : Number(d.costo.replace(',', '.')) || costoBase,
        activo: d.activo,
      })),
    })
    setGuardando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setOk('Variantes guardadas')
    const rec = await listarVariantesProducto(requireSupabase(), productoId)
    if (!rec.error) setExistentes(rec.filas)
  }

  const cols = attrsActivos.map((a) => a.nombre)

  return (
    <div className="mt-6 rounded-lg border border-[#E2E8F0] p-4">
      <h2 className="text-sm font-bold text-[#1A2F4A]">Variantes</h2>
      <p className="mt-1 text-xs text-[#4A5568]">Este producto tiene:</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {atributos.map((a) => (
          <label key={a.id} className="flex items-center gap-2 text-sm text-[#1A2F4A]">
            <input
              type="checkbox"
              checked={elegidos.includes(a.nombre)}
              onChange={(ev) => {
                setElegidos((prev) =>
                  ev.target.checked ? [...prev, a.nombre] : prev.filter((n) => n !== a.nombre),
                )
              }}
            />
            {a.nombre}
          </label>
        ))}
      </div>
      {atributos.length === 0 ? (
        <p className="mt-2 text-xs text-[#4A5568]">
          Configurá atributos globales en Configuración → Variantes.
        </p>
      ) : null}
      {drafts.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="text-[#4A5568]">
                {cols.map((c) => (
                  <th key={c} className="py-2 pr-2 font-semibold">
                    {c}
                  </th>
                ))}
                <th className="py-2 pr-2 font-semibold">SKU</th>
                <th className="py-2 pr-2 font-semibold">Precio</th>
                <th className="py-2 pr-2 font-semibold">Costo</th>
                <th className="py-2 font-semibold">Activo</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d, i) => (
                <tr key={etiquetaCombo(d.atributos)} className="border-t border-[#E2E8F0]">
                  {cols.map((c) => (
                    <td key={c} className="py-2 pr-2 text-[#1A2F4A]">
                      {d.atributos[c]}
                    </td>
                  ))}
                  <td className="py-2 pr-2">
                    <input
                      className={inputClass}
                      value={d.sku}
                      onChange={(ev) => {
                        const sku = ev.target.value
                        setDrafts((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, sku, skuManual: true } : x)),
                        )
                      }}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      placeholder={String(precioBase)}
                      value={d.precio}
                      onChange={(ev) => {
                        const precio = ev.target.value
                        setDrafts((prev) => prev.map((x, j) => (j === i ? { ...x, precio } : x)))
                      }}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      placeholder={costoBase == null ? '' : String(costoBase)}
                      value={d.costo}
                      onChange={(ev) => {
                        const costo = ev.target.value
                        setDrafts((prev) => prev.map((x, j) => (j === i ? { ...x, costo } : x)))
                      }}
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={d.activo}
                      onChange={(ev) => {
                        const activo = ev.target.checked
                        setDrafts((prev) => prev.map((x, j) => (j === i ? { ...x, activo } : x)))
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-[#DC2626]">{error}</p> : null}
      {ok ? <p className="mt-3 text-sm text-[#16A34A]">{ok}</p> : null}
      <button
        className="mt-4 h-11 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
        type="button"
        disabled={guardando || drafts.length === 0}
        onClick={() => void guardar()}
      >
        {guardando ? 'GUARDANDO…' : 'Guardar variantes'}
      </button>
    </div>
  )
})
