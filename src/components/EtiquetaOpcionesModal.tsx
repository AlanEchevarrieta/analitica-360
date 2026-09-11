import { useEffect, useState } from 'react'
import {
  guardarOpcionesEtiqueta,
  leerOpcionesEtiqueta,
  type OpcionesEtiqueta,
  type TamanoEtiqueta,
} from '../lib/codigoBarras'
import { theme } from '../theme'

const CHECKS: { key: keyof Omit<OpcionesEtiqueta, 'tamano'>; label: string }[] = [
  { key: 'mostrarPrecio', label: 'Mostrar precio' },
  { key: 'mostrarNombre', label: 'Mostrar nombre del producto' },
  { key: 'mostrarVariante', label: 'Mostrar variante (si tiene)' },
  { key: 'mostrarBarras', label: 'Mostrar código de barras' },
  { key: 'mostrarQr', label: 'Mostrar QR' },
  { key: 'mostrarUrl', label: 'Mostrar URL (analitica360.app)' },
]

const TAMANOS: { id: TamanoEtiqueta; label: string }[] = [
  { id: 'pequena', label: 'Pequeña (4×2.5 cm)' },
  { id: 'mediana', label: 'Mediana (6×4 cm)' },
  { id: 'grande', label: 'Grande (9×6 cm)' },
]

export function EtiquetaOpcionesModal({
  abierto,
  cantidad,
  imprimiendo,
  onCerrar,
  onImprimir,
}: {
  abierto: boolean
  cantidad: number
  imprimiendo: boolean
  onCerrar: () => void
  onImprimir: (op: OpcionesEtiqueta) => void
}) {
  const [op, setOp] = useState<OpcionesEtiqueta>(() => leerOpcionesEtiqueta())

  useEffect(() => {
    if (!abierto) return
    setOp(leerOpcionesEtiqueta())
  }, [abierto])

  if (!abierto) return null

  function toggle(key: keyof Omit<OpcionesEtiqueta, 'tamano'>) {
    setOp((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-[440px] rounded-lg p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
        style={{ background: theme.card, fontFamily: theme.font }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#1A2F4A]">Opciones de etiqueta</h2>
            <p className="mt-1 text-sm text-[#4A5568]">
              {cantidad === 1
                ? '1 etiqueta'
                : `${cantidad} etiquetas · A4 en grilla de ${op.tamano === 'pequena' ? '4' : op.tamano === 'grande' ? '2' : '3'} columnas`}
            </p>
          </div>
          <button className="text-sm font-semibold text-[#4A5568]" type="button" onClick={onCerrar}>
            Cerrar
          </button>
        </div>

        <p className="mb-2 text-sm font-medium text-[#4A5568]">Tamaño</p>
        <div className="mb-4 flex flex-col gap-2">
          {TAMANOS.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm text-[#1A2F4A]">
              <input
                type="radio"
                name="tamano-etiqueta"
                checked={op.tamano === t.id}
                onChange={() => setOp((prev) => ({ ...prev, tamano: t.id }))}
              />
              {t.label}
            </label>
          ))}
        </div>

        <p className="mb-2 text-sm font-medium text-[#4A5568]">Campos</p>
        <div className="flex flex-col gap-2">
          {CHECKS.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-center gap-2 text-sm text-[#1A2F4A]">
              <input type="checkbox" checked={op[c.key]} onChange={() => toggle(c.key)} />
              {c.label}
            </label>
          ))}
        </div>

        <button
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50"
          type="button"
          disabled={imprimiendo}
          onClick={() => {
            guardarOpcionesEtiqueta(op)
            onImprimir(op)
          }}
        >
          {imprimiendo ? 'Generando…' : 'Imprimir'}
        </button>
      </div>
    </div>
  )
}
