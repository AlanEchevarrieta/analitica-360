import { useEffect, useRef, useState, type ReactNode } from 'react'
import { errorArchivoImportacion } from '../lib/validarArchivoImportacion'
import { theme } from '../theme'

function linkAyudaFormato() {
  const numero = (import.meta.env.VITE_WHATSAPP_CONTACT ?? '549XXXXXXXXXX').replace(/\D/g, '')
  const texto = encodeURIComponent(
    'Hola, tengo un Excel en otro formato y necesito ayuda para importar ventas o compras',
  )
  return `https://wa.me/${numero}?text=${texto}`
}

const sep = { borderTop: '1px solid rgba(255,255,255,0.06)' } as const

export function ImportarOperacionModal({
  titulo,
  onCerrar,
  onPlantilla,
  onArchivo,
  onConfirmar,
  preview,
  listos,
}: {
  titulo: string
  onCerrar: () => void
  onPlantilla: () => Promise<void>
  onArchivo: (file: File) => Promise<{ ok: boolean; error?: string }>
  onConfirmar: (onProgreso: (hechos: number, total: number) => void) => Promise<{ toast: string; errores: string[] }>
  preview: ReactNode
  listos: number
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const toastTimer = useRef<number | null>(null)
  const [archivo, setArchivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [advertencias, setAdvertencias] = useState<string[]>([])
  const [importando, setImportando] = useState(false)
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 })
  const [arrastrando, setArrastrando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [oculto, setOculto] = useState(false)
  const whatsapp = linkAyudaFormato()

  useEffect(() => {
    void import('xlsx')
    return () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current)
    }
  }, [])

  async function cargar(file: File | undefined) {
    setError(null)
    setAdvertencias([])
    if (!file) return
    const rechazo = errorArchivoImportacion(file)
    if (rechazo) {
      setError(rechazo)
      return
    }
    setArchivo(file.name)
    try {
      const res = await onArchivo(file)
      if (!res.ok) {
        setError(res.error ?? 'No encontramos filas para importar.')
      }
    } catch {
      setError('No se pudo leer el archivo.')
    }
  }

  async function confirmar() {
    if (listos === 0) {
      setError('No hay filas válidas para importar')
      return
    }
    setImportando(true)
    setProgreso({ hechos: 0, total: listos })
    setError(null)
    try {
      const res = await onConfirmar((hechos, total) => setProgreso({ hechos, total }))
      setAdvertencias(res.errores)
      setToast(res.toast)
      if (res.errores.length === 0) {
        setOculto(true)
        if (toastTimer.current != null) window.clearTimeout(toastTimer.current)
        toastTimer.current = window.setTimeout(() => {
          setToast(null)
          onCerrar()
        }, 3000)
      }
    } catch {
      setError('No se pudo completar la importación.')
    }
    setImportando(false)
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
          maxWidth: 560,
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
            {titulo}
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
            onClick={() => void onPlantilla()}
          >
            <span aria-hidden>⬇️</span> Descargar plantilla Excel
          </button>
        </div>

        <div className="mt-6 pt-6" style={sep}>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".xlsx,.csv"
            onChange={(ev) => void cargar(ev.target.files?.[0])}
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
              void cargar(ev.dataTransfer.files?.[0])
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

        {preview}

        {error ? (
          <p className="mt-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}
        {advertencias.length > 0 ? (
          <ul className="mt-3 max-h-32 overflow-auto text-xs text-[#FCD34D]">
            {advertencias.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : null}

        <p className="mt-4 text-center text-[13px] text-[#94A3B8]">
          ¿Tenés datos en otro formato?{' '}
          <a className="font-semibold text-[#6366F1] hover:underline" href={whatsapp} target="_blank" rel="noreferrer">
            Escribinos y te ayudamos a adaptarlo.
          </a>
        </p>

        <div className="mt-6 pt-6" style={sep}>
          <button
            className="flex w-full items-center justify-center gap-2 text-sm font-bold text-white hover:bg-[#4F46E5] disabled:opacity-50"
            type="button"
            disabled={importando || listos === 0}
            style={{ background: '#6366F1', borderRadius: 8, padding: 14 }}
            onClick={() => void confirmar()}
          >
            <span aria-hidden>✓</span>
            {importando
              ? `IMPORTANDO… ${progreso.hechos} / ${progreso.total || listos}`
              : 'Confirmar importación'}
          </button>
        </div>
      </div>
      {toast ? (
        <div
          className="fixed right-4 bottom-4 z-[60] max-w-sm rounded-lg px-4 py-3 text-sm font-semibold shadow-lg"
          style={{ background: '#4ADE80', color: '#0F1729' }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}

export function PreviewTablaImport({
  headers,
  children,
  listos,
  errores,
}: {
  headers: string[]
  children: ReactNode
  listos: number
  errores: number
}) {
  return (
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
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className="inline-block text-xs font-medium text-[#4ADE80]"
          style={{
            background: 'rgba(74,222,128,0.1)',
            borderRadius: 999,
            padding: '4px 12px',
          }}
        >
          {listos} filas listas para importar
        </span>
        {errores > 0 ? (
          <span
            className="inline-block text-xs font-medium text-[#FCD34D]"
            style={{
              background: 'rgba(245,158,11,0.12)',
              borderRadius: 999,
              padding: '4px 12px',
            }}
          >
            {errores} {errores === 1 ? 'fila con error' : 'filas con errores'}
          </span>
        ) : null}
      </div>
    </div>
  )
}
