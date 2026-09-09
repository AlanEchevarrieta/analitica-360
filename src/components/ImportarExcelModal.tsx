import { useEffect, useRef, useState } from 'react'
import {
  descargarPlantillaProductos,
  importarProductos,
  leerArchivoProductos,
  type FilaImportacion,
} from '../lib/importarProductos'
import type { ProductoFila } from '../lib/productos'
import { formatoARS } from '../lib/productos'
import { requireSupabase } from '../lib/supabase'
import { theme } from '../theme'

const sep = { borderTop: '1px solid rgba(255,255,255,0.06)' } as const

export function ImportarExcelModal({
  existentes,
  onCerrar,
  onListo,
}: {
  existentes: ProductoFila[]
  onCerrar: () => void
  onListo: () => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const toastTimer = useRef<number | null>(null)
  const [filas, setFilas] = useState<FilaImportacion[]>([])
  const [archivo, setArchivo] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [advertencias, setAdvertencias] = useState<string[]>([])
  const [importando, setImportando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [oculto, setOculto] = useState(false)

  useEffect(() => {
    void import('xlsx')
    return () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current)
    }
  }, [])

  async function onArchivo(file: File | undefined) {
    setError(null)
    setAdvertencias([])
    if (!file) return
    const nombre = file.name.toLowerCase()
    if (!nombre.endsWith('.xlsx') && !nombre.endsWith('.xls') && !nombre.endsWith('.csv')) {
      setError('Subí un archivo .xlsx o .csv')
      return
    }
    setArchivo(file.name)
    try {
      const data = await leerArchivoProductos(file)
      if (data.length === 0) {
        setFilas([])
        setError('No encontramos filas con nombre de producto.')
        return
      }
      setFilas(data)
    } catch {
      setError('No se pudo leer el archivo.')
    }
  }

  async function confirmar() {
    if (filas.length === 0) {
      setError('Subí un archivo primero')
      return
    }
    setImportando(true)
    setError(null)
    const { importados, saltados } = await importarProductos(requireSupabase(), filas, existentes)
    setImportando(false)
    setAdvertencias(saltados)
    await onListo()
    setOculto(true)
    setToast(`✅ ${importados} productos importados correctamente`)
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      onCerrar()
    }, 3000)
  }

  if (oculto) {
    return toast ? (
      <div
        className="fixed right-4 bottom-4 z-[60] max-w-sm rounded-lg px-4 py-3 text-sm font-semibold shadow-lg"
        style={{ background: '#4ADE80', color: '#0F1729' }}
      >
        {toast}
      </div>
    ) : null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}>
      <div
        className="max-h-[90vh] w-full overflow-auto text-white"
        style={{
          maxWidth: 520,
          background: '#0F1729',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          fontFamily: theme.font,
        }}
      >
        <div className="relative pr-8">
          <h2 className="text-[22px] leading-tight text-[#F1F5F9]" style={{ fontFamily: theme.fontDisplay }}>
            Importar Excel
          </h2>
          <button
            className="absolute top-0 right-0 text-lg leading-none text-[#94A3B8] hover:text-[#F1F5F9]"
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
          >
            ✕
          </button>
        </div>

        <div className="mt-6 pt-6" style={sep}>
          <button
            className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-[#6366F1] hover:bg-[rgba(99,102,241,0.1)]"
            type="button"
            style={{
              background: 'transparent',
              border: '1px solid rgba(99,102,241,0.5)',
              borderRadius: 8,
              padding: '12px 20px',
            }}
            onClick={() => void descargarPlantillaProductos()}
          >
            <span aria-hidden>⬇️</span> Descargar plantilla Excel
          </button>
        </div>

        <div className="mt-6 pt-6" style={sep}>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(ev) => void onArchivo(ev.target.files?.[0])}
          />
          <button
            type="button"
            className="w-full text-center transition-colors"
            style={{
              border: archivo
                ? '2px dashed rgba(74,222,128,0.45)'
                : arrastrando
                  ? '2px dashed #6366F1'
                  : '2px dashed rgba(99,102,241,0.4)',
              background: archivo
                ? 'rgba(74,222,128,0.05)'
                : arrastrando
                  ? 'rgba(99,102,241,0.1)'
                  : 'rgba(99,102,241,0.05)',
              borderRadius: 12,
              padding: 32,
            }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(ev) => {
              ev.preventDefault()
              setArrastrando(true)
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(ev) => {
              ev.preventDefault()
              setArrastrando(false)
              void onArchivo(ev.dataTransfer.files?.[0])
            }}
            onMouseEnter={(ev) => {
              if (archivo) return
              ev.currentTarget.style.borderColor = '#6366F1'
              ev.currentTarget.style.background = 'rgba(99,102,241,0.1)'
            }}
            onMouseLeave={(ev) => {
              if (archivo) return
              if (arrastrando) {
                ev.currentTarget.style.border = '2px dashed #6366F1'
                ev.currentTarget.style.background = 'rgba(99,102,241,0.1)'
                return
              }
              ev.currentTarget.style.border = '2px dashed rgba(99,102,241,0.4)'
              ev.currentTarget.style.background = 'rgba(99,102,241,0.05)'
            }}
          >
            {archivo ? (
              <p className="text-sm font-medium text-[#4ADE80]">
                <span className="mr-1" aria-hidden>
                  ✅
                </span>
                {archivo}
              </p>
            ) : (
              <>
                <p className="text-center" style={{ fontSize: 32, lineHeight: 1 }} aria-hidden>
                  📂
                </p>
                <p className="mt-3 text-sm font-medium text-[#F1F5F9]">Arrastrá tu archivo acá</p>
                <p className="mt-1 text-[13px] text-[#94A3B8]">o hacé clic para seleccionar</p>
              </>
            )}
          </button>
        </div>

        {filas.length > 0 ? (
          <div className="mt-6 pt-6" style={sep}>
            <p
              className="mb-3 text-[13px] font-medium uppercase text-[#94A3B8]"
              style={{ letterSpacing: '0.08em' }}
            >
              Vista previa
            </p>
            <div className="overflow-x-auto rounded-lg">
              <table className="w-full min-w-[440px] text-left">
                <thead>
                  <tr className="text-[11px] text-[#94A3B8]" style={{ background: 'rgba(99,102,241,0.1)' }}>
                    <th className="px-3 py-2 font-semibold">Nombre</th>
                    <th className="px-3 py-2 font-semibold">Categoría</th>
                    <th className="px-3 py-2 font-semibold">Precio</th>
                    <th className="px-3 py-2 font-semibold">Costo</th>
                    <th className="px-3 py-2 font-semibold">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.slice(0, 5).map((f, i) => (
                    <tr
                      key={`${f.nombre}-${i}`}
                      className="text-[13px] text-[#F1F5F9]"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <td className="px-3 py-2">{f.nombre}</td>
                      <td className="px-3 py-2">{f.categoria || '—'}</td>
                      <td className="px-3 py-2">{formatoARS(f.precioVenta)}</td>
                      <td className="px-3 py-2">{formatoARS(f.costo)}</td>
                      <td className="px-3 py-2">{f.stockInicial}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span
              className="mt-3 inline-block text-xs font-medium text-[#4ADE80]"
              style={{
                background: 'rgba(74,222,128,0.1)',
                borderRadius: 999,
                padding: '4px 12px',
              }}
            >
              {filas.length} filas listas para importar
            </span>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}
        {advertencias.length > 0 ? (
          <ul className="mt-3 max-h-28 overflow-auto text-xs text-[#FCD34D]">
            {advertencias.map((a) => (
              <li key={a}>Saltado: {a}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 pt-6" style={sep}>
          <button
            className="flex w-full items-center justify-center gap-2 text-sm font-bold text-white hover:bg-[#4F46E5] disabled:opacity-50"
            type="button"
            disabled={importando || filas.length === 0}
            style={{ background: '#6366F1', borderRadius: 8, padding: 14 }}
            onClick={() => void confirmar()}
          >
            <span aria-hidden>✓</span>
            {importando ? 'IMPORTANDO…' : 'Confirmar importación'}
          </button>
        </div>
      </div>
    </div>
  )
}
