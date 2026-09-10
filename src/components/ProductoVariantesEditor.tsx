import { useEffect, useImperativeHandle, useMemo, useState, forwardRef } from 'react'
import { AjustarStockModal } from './AjustarStockModal'
import {
  combinacionesDe,
  etiquetaCombo,
  guardarVariantesProducto,
  listarAtributos,
  listarVariantesProducto,
  mismaCombinacion,
  registrarStockInicialVariante,
  skuAutomatico,
  stockPorVariante,
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
  stockInicial?: string
  stockActual?: number
}

export type ProductoVariantesHandle = {
  persistir: (productoId: string) => Promise<string | null>
}

function CeldaStockActual({
  draft,
  index,
  productoId,
  nombreProducto,
  stockMap,
  onStock,
  onAjustar,
}: {
  draft: VarianteDraft
  index: number
  productoId: string | null
  nombreProducto: string
  stockMap: Map<string, number>
  onStock: (index: number, value: string) => void
  onAjustar: (input: { varianteId: string; nombre: string; stock: number }) => void
}) {
  const actual = draft.id ? (stockMap.get(draft.id) ?? draft.stockActual ?? 0) : 0
  if (draft.id && actual > 0 && productoId) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[#1A2F4A]">{actual}</span>
        <button
          type="button"
          className="text-[11px] font-semibold text-[#6366F1]"
          onClick={() =>
            onAjustar({
              varianteId: draft.id!,
              nombre: `${nombreProducto} — ${etiquetaCombo(draft.atributos)}`,
              stock: actual,
            })
          }
        >
          ✏️ Ajustar
        </button>
      </div>
    )
  }
  return (
    <input
      className={inputClass}
      type="number"
      min={0}
      step={1}
      placeholder="0"
      value={draft.stockInicial ?? ''}
      onChange={(ev) => onStock(index, ev.target.value)}
    />
  )
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
  const [continuarMuchas, setContinuarMuchas] = useState(false)
  const [hidratar, setHidratar] = useState(false)
  const [modoCarga, setModoCarga] = useState<'automatico' | 'manual'>('automatico')
  const [mostrarAlta, setMostrarAlta] = useState(false)
  const [altaSel, setAltaSel] = useState<Record<string, string>>({})
  const [altaSku, setAltaSku] = useState('')
  const [altaSkuManual, setAltaSkuManual] = useState(false)
  const [altaPrecio, setAltaPrecio] = useState('')
  const [altaCosto, setAltaCosto] = useState('')
  const [altaStock, setAltaStock] = useState('0')
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map())
  const [ajuste, setAjuste] = useState<{
    varianteId: string
    nombre: string
    stock: number
  } | null>(null)

  useEffect(() => {
    void listarAtributos(requireSupabase()).then((res) => {
      if (!res.error) setAtributos(res.filas)
    })
  }, [])

  useEffect(() => {
    if (!productoId) return
    void (async () => {
      const res = await listarVariantesProducto(requireSupabase(), productoId)
      if (res.error || res.filas.length === 0) return
      const stocks = await stockPorVariante(
        requireSupabase(),
        res.filas.map((v) => v.id),
      )
      setStockMap(stocks)
      setExistentes(res.filas)
      const keys = [...new Set(res.filas.flatMap((v) => Object.keys(v.atributos)))]
      setHidratar(true)
      setElegidos(keys)
      setDrafts(
        res.filas.map((v) => {
          const actual = stocks.get(v.id) ?? 0
          return {
            id: v.id,
            sku: v.sku,
            atributos: v.atributos,
            precio: v.precioVenta == null ? '' : String(v.precioVenta),
            costo: v.costo == null ? '' : String(v.costo),
            activo: v.activo,
            skuManual: Boolean(v.sku),
            stockActual: actual,
            stockInicial: actual > 0 ? '' : '0',
          }
        }),
      )
    })()
  }, [productoId])

  const attrsActivos = useMemo(
    () => atributos.filter((a) => elegidos.includes(a.nombre)),
    [atributos, elegidos],
  )

  const cantidadPrevista = useMemo(() => combinacionesDe(attrsActivos).length, [attrsActivos])
  const esperaConfirmacion =
    modoCarga === 'automatico' && cantidadPrevista > 50 && !continuarMuchas && !hidratar

  const altaCombo = useMemo(() => {
    const combo: Record<string, string> = {}
    for (const a of attrsActivos) {
      if (altaSel[a.nombre]) combo[a.nombre] = altaSel[a.nombre]
    }
    return combo
  }, [attrsActivos, altaSel])

  useEffect(() => {
    if (modoCarga !== 'manual' || altaSkuManual) return
    if (attrsActivos.some((a) => !altaSel[a.nombre])) {
      setAltaSku('')
      return
    }
    setAltaSku(skuAutomatico(nombreProducto, altaCombo))
  }, [modoCarga, altaSkuManual, attrsActivos, altaSel, altaCombo, nombreProducto])

  useEffect(() => {
    if (modoCarga === 'manual') return
    if (attrsActivos.length === 0) {
      if (existentes.length === 0) setDrafts([])
      return
    }
    if (cantidadPrevista > 50 && !continuarMuchas) {
      return
    }
    const combos = combinacionesDe(attrsActivos)
    setDrafts((prev) =>
      combos.map((atributosCombo) => {
        const prevMatch = prev.find((d) => mismaCombinacion(d.atributos, atributosCombo))
        if (prevMatch) return { ...prevMatch, atributos: atributosCombo }
        const ex = existentes.find((e) => mismaCombinacion(e.atributos, atributosCombo))
        const sku = skuAutomatico(nombreProducto, atributosCombo)
        const actual = ex?.id ? (stockMap.get(ex.id) ?? 0) : 0
        return {
          id: ex?.id,
          sku: ex?.sku || sku,
          atributos: atributosCombo,
          precio: ex?.precioVenta != null ? String(ex.precioVenta) : '',
          costo: ex?.costo != null ? String(ex.costo) : '',
          activo: ex?.activo ?? true,
          skuManual: Boolean(ex?.sku),
          stockActual: actual,
          stockInicial: actual > 0 ? '' : '0',
        }
      }),
    )
  }, [attrsActivos, nombreProducto, existentes, cantidadPrevista, continuarMuchas, modoCarga, stockMap])

  useEffect(() => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.skuManual ? d : { ...d, sku: skuAutomatico(nombreProducto, d.atributos) },
      ),
    )
  }, [nombreProducto])

  async function persistirDrafts(pid: string): Promise<string | null> {
    if (drafts.length === 0) return null
    const client = requireSupabase()
    const pendientes = drafts.filter((d) => {
      const actual = d.id ? (stockMap.get(d.id) ?? d.stockActual ?? 0) : 0
      if (actual > 0) return false
      const n = Number.parseInt(d.stockInicial ?? '', 10)
      return Number.isFinite(n) && n > 0
    })
    const fallo = await guardarVariantesProducto(client, {
      productoId: pid,
      empresaId,
      variantes: drafts.map((d) => ({
        id: d.id,
        sku: d.sku,
        atributos: d.atributos,
        precioVenta: (() => {
          const n = Number(d.precio.replace(',', '.'))
          return d.precio.trim() === '' || !Number.isFinite(n) ? precioBase : n
        })(),
        costo: (() => {
          const n = Number(d.costo.replace(',', '.'))
          return d.costo.trim() === '' || !Number.isFinite(n) ? costoBase : n
        })(),
        activo: d.activo,
      })),
    })
    if (fallo) return fallo
    const rec = await listarVariantesProducto(client, pid)
    if (rec.error) return rec.error
    const stocks = await stockPorVariante(client, rec.filas.map((v) => v.id))
    for (const d of pendientes) {
      const fila = rec.filas.find((v) => mismaCombinacion(v.atributos, d.atributos))
      if (!fila) continue
      if ((stocks.get(fila.id) ?? 0) > 0) continue
      const n = Number.parseInt(d.stockInicial ?? '', 10)
      const stockErr = await registrarStockInicialVariante(client, {
        productoId: pid,
        empresaId,
        varianteId: fila.id,
        cantidad: n,
      })
      if (stockErr) return stockErr
    }
    const stocksFinal = await stockPorVariante(client, rec.filas.map((v) => v.id))
    setStockMap(stocksFinal)
    setExistentes(rec.filas)
    setDrafts(
      rec.filas.map((v) => {
        const actual = stocksFinal.get(v.id) ?? 0
        return {
          id: v.id,
          sku: v.sku,
          atributos: v.atributos,
          precio: v.precioVenta == null ? '' : String(v.precioVenta),
          costo: v.costo == null ? '' : String(v.costo),
          activo: v.activo,
          skuManual: Boolean(v.sku),
          stockActual: actual,
          stockInicial: actual > 0 ? '' : '0',
        }
      }),
    )
    return null
  }

  useImperativeHandle(
    ref,
    () => ({
      persistir: (pid: string) => persistirDrafts(pid),
    }),
    [drafts, empresaId, precioBase, costoBase, stockMap],
  )

  function agregarManual() {
    if (attrsActivos.length === 0) {
      setError('Tildá al menos un atributo')
      return
    }
    if (attrsActivos.some((a) => !altaSel[a.nombre])) {
      setError('Completá todos los atributos de la variante')
      return
    }
    if (drafts.some((d) => mismaCombinacion(d.atributos, altaCombo))) {
      setError('Esa combinación ya está en la lista')
      return
    }
    const sku = altaSku.trim() || skuAutomatico(nombreProducto, altaCombo)
    setDrafts((prev) => [
      ...prev,
      {
        sku,
        atributos: { ...altaCombo },
        precio: altaPrecio,
        costo: altaCosto,
        activo: true,
        skuManual: altaSkuManual || Boolean(altaSku.trim()),
        stockInicial: altaStock.trim() === '' ? '0' : altaStock,
        stockActual: 0,
      },
    ])
    setAltaSel({})
    setAltaSku('')
    setAltaSkuManual(false)
    setAltaPrecio('')
    setAltaCosto('')
    setAltaStock('0')
    setMostrarAlta(false)
    setError(null)
  }

  const cols = attrsActivos.map((a) => a.nombre)
  const cantidadUi = esperaConfirmacion ? cantidadPrevista : drafts.length

  return (
    <div className="mt-6 rounded-lg border border-[#E2E8F0] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-[#1A2F4A]">Variantes de este producto</h2>
        {modoCarga === 'automatico' && cantidadUi > 100 ? (
          <span className="rounded-full bg-[#7F1D1D] px-2.5 py-0.5 text-[11px] font-semibold text-[#FECACA]">
            🔴 Demasiadas variantes — reducí los atributos
          </span>
        ) : modoCarga === 'automatico' && cantidadUi > 30 ? (
          <span className="rounded-full bg-[#78350F] px-2.5 py-0.5 text-[11px] font-semibold text-[#FCD34D]">
            ⚠️ Muchas variantes
          </span>
        ) : null}
        {cantidadUi > 0 ? (
          <span className="text-xs text-[#4A5568]">
            {modoCarga === 'manual' ? `${cantidadUi} variantes cargadas` : `${cantidadUi} variantes a crear`}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-[#4A5568]">
        Configurá las versiones que vendés (por color, material, etc.) y su stock
      </p>
      <p className="mt-2 text-xs text-[#4A5568]">
        💡 Cada variante tiene su propio stock. Ingresá cuántas unidades tenés de cada una.
      </p>
      <p className="mt-3 text-xs text-[#4A5568]">Este producto tiene:</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {atributos.map((a) => (
          <label key={a.id} className="flex items-center gap-2 text-sm text-[#1A2F4A]">
            <input
              type="checkbox"
              checked={elegidos.includes(a.nombre)}
              onChange={(ev) => {
                setHidratar(false)
                setContinuarMuchas(false)
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

      <p className="mt-4 text-sm font-medium text-[#1A2F4A]">Modo de carga</p>
      <label className="mt-2 flex items-start gap-2 text-sm text-[#1A2F4A]">
        <input
          type="radio"
          className="mt-1 accent-[#6366F1]"
          name="modo-carga-variantes"
          checked={modoCarga === 'automatico'}
          onChange={() => setModoCarga('automatico')}
        />
        <span>
          Automático (genera todas las combinaciones)
          <span className="mt-0.5 block text-xs text-[#4A5568]">
            Recomendado para menos de 30 combinaciones. Para catálogos grandes usá el modo manual.
          </span>
        </span>
      </label>
      <label className="mt-2 flex items-start gap-2 text-sm text-[#1A2F4A]">
        <input
          type="radio"
          className="mt-1 accent-[#6366F1]"
          name="modo-carga-variantes"
          checked={modoCarga === 'manual'}
          onChange={() => {
            setModoCarga('manual')
            setMostrarAlta(false)
          }}
        />
        Manual (agregás solo las que existen)
      </label>

      {modoCarga === 'automatico' && esperaConfirmacion ? (
        <div className="mt-4 rounded-md border border-[#F59E0B] bg-[#FFFBEB] px-3 py-3 text-sm text-[#1A2F4A]">
          <p>
            Vas a generar {cantidadPrevista} variantes. ¿Querés continuar o reducir los atributos?
          </p>
          <p className="mt-2 text-xs text-[#4A5568]">
            Si continuás, desactivá las combinaciones que no vendés antes de guardar.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              className="h-10 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5]"
              type="button"
              onClick={() => setContinuarMuchas(true)}
            >
              Continuar
            </button>
            <button
              className="h-10 w-full rounded-md border border-[#E2E8F0] text-sm font-semibold text-[#4A5568]"
              type="button"
              onClick={() => {
                setContinuarMuchas(false)
                setElegidos((prev) => prev.slice(0, -1))
              }}
            >
              Reducir
            </button>
          </div>
        </div>
      ) : null}
      {modoCarga === 'automatico' && drafts.length > 0 && !esperaConfirmacion ? (
        <div className="mt-4 overflow-x-auto">
          <p className="mb-2 text-xs text-[#4A5568]">
            Desactivá las combinaciones que no vendés antes de guardar.
          </p>
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="text-[#4A5568]">
                {cols.map((c) => (
                  <th key={c} className="py-2 pr-2 font-semibold">
                    {c}
                  </th>
                ))}
                <th className="py-2 pr-2 font-semibold">Precio</th>
                <th className="py-2 pr-2 font-semibold">Costo</th>
                <th className="py-2 pr-2 font-semibold">Stock actual</th>
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
                  <td className="py-2 pr-2">
                    <CeldaStockActual
                      draft={d}
                      index={i}
                      productoId={productoId}
                      nombreProducto={nombreProducto}
                      stockMap={stockMap}
                      onStock={(index, value) =>
                        setDrafts((prev) =>
                          prev.map((x, j) => (j === index ? { ...x, stockInicial: value } : x)),
                        )
                      }
                      onAjustar={setAjuste}
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={d.activo}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                        d.activo ? 'bg-[#6366F1]' : 'bg-[#CBD5E1]'
                      }`}
                      onClick={() => {
                        setDrafts((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, activo: !x.activo } : x)),
                        )
                      }}
                    >
                      <span
                        className={`mt-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          d.activo ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {modoCarga === 'manual' ? (
        <div className="mt-4">
          {!mostrarAlta ? (
            <button
              className="h-10 w-full rounded-md border border-[#E2E8F0] text-sm font-semibold text-[#6366F1]"
              type="button"
              onClick={() => {
                setMostrarAlta(true)
                setAltaSkuManual(false)
                setError(null)
              }}
            >
              ➕ Agregar variante
            </button>
          ) : (
            <div className="rounded-md border border-[#E2E8F0] p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {attrsActivos.map((a) => (
                  <label key={a.id} className="text-xs font-medium text-[#4A5568]">
                    {a.nombre}
                    <select
                      className={`${inputClass} mt-1`}
                      value={altaSel[a.nombre] ?? ''}
                      onChange={(ev) => {
                        const val = ev.target.value
                        setAltaSel((prev) => ({ ...prev, [a.nombre]: val }))
                        setAltaSkuManual(false)
                      }}
                    >
                      <option value="">Elegí</option>
                      {a.valores.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <label className="mt-2 block text-xs font-medium text-[#4A5568]">
                SKU
                <input
                  className={`${inputClass} mt-1`}
                  value={altaSku}
                  onChange={(ev) => {
                    setAltaSku(ev.target.value)
                    setAltaSkuManual(true)
                  }}
                />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-[#4A5568]">
                  Precio
                  <input
                    className={`${inputClass} mt-1`}
                    inputMode="decimal"
                    placeholder={String(precioBase)}
                    value={altaPrecio}
                    onChange={(ev) => setAltaPrecio(ev.target.value)}
                  />
                </label>
                <label className="text-xs font-medium text-[#4A5568]">
                  Costo
                  <input
                    className={`${inputClass} mt-1`}
                    inputMode="decimal"
                    placeholder={costoBase == null ? '' : String(costoBase)}
                    value={altaCosto}
                    onChange={(ev) => setAltaCosto(ev.target.value)}
                  />
                </label>
              </div>
              <label className="mt-2 block text-xs font-medium text-[#4A5568]">
                Stock inicial
                <input
                  className={`${inputClass} mt-1`}
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={altaStock}
                  onChange={(ev) => setAltaStock(ev.target.value)}
                />
              </label>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  className="h-10 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5]"
                  type="button"
                  onClick={agregarManual}
                >
                  Agregar
                </button>
                <button
                  className="text-xs text-[#4A5568]"
                  type="button"
                  onClick={() => setMostrarAlta(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {drafts.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <p className="mb-2 text-xs text-[#4A5568]">Solo se guardan las variantes que cargaste.</p>
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="text-[#4A5568]">
                    {cols.map((c) => (
                      <th key={c} className="py-2 pr-2 font-semibold">
                        {c}
                      </th>
                    ))}
                    <th className="py-2 pr-2 font-semibold">Precio</th>
                    <th className="py-2 pr-2 font-semibold">Costo</th>
                    <th className="py-2 pr-2 font-semibold">Stock actual</th>
                    <th className="py-2 pr-2 font-semibold">Activo</th>
                    <th className="py-2 font-semibold" />
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
                      <td className="py-2 pr-2">
                        <CeldaStockActual
                      draft={d}
                      index={i}
                      productoId={productoId}
                      nombreProducto={nombreProducto}
                      stockMap={stockMap}
                      onStock={(index, value) =>
                        setDrafts((prev) =>
                          prev.map((x, j) => (j === index ? { ...x, stockInicial: value } : x)),
                        )
                      }
                      onAjustar={setAjuste}
                    />
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={d.activo}
                          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                            d.activo ? 'bg-[#6366F1]' : 'bg-[#CBD5E1]'
                          }`}
                          onClick={() => {
                            setDrafts((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, activo: !x.activo } : x)),
                            )
                          }}
                        >
                          <span
                            className={`mt-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              d.activo ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-2">
                        <button
                          className="text-xs text-[#DC2626]"
                          type="button"
                          onClick={() =>
                            setDrafts((prev) => prev.filter((_, j) => j !== i))
                          }
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-[#DC2626]">{error}</p> : null}
      {ajuste && productoId ? (
        <AjustarStockModal
          producto={{ id: productoId, nombre: ajuste.nombre, stock: ajuste.stock }}
          varianteId={ajuste.varianteId}
          empresaId={empresaId}
          onCerrar={() => setAjuste(null)}
          onOk={() => {
            setAjuste(null)
            void (async () => {
              const rec = await listarVariantesProducto(requireSupabase(), productoId)
              if (rec.error) return
              const stocks = await stockPorVariante(
                requireSupabase(),
                rec.filas.map((v) => v.id),
              )
              setStockMap(stocks)
              setExistentes(rec.filas)
              setDrafts((prev) =>
                prev.map((d) => {
                  if (!d.id) return d
                  const actual = stocks.get(d.id) ?? 0
                  return { ...d, stockActual: actual, stockInicial: actual > 0 ? '' : '0' }
                }),
              )
            })()
          }}
        />
      ) : null}
    </div>
  )
})
