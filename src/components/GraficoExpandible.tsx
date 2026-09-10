import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Maximize2 as MaximizeIcon } from 'lucide-react'
import { theme } from '../theme'

export function SelectorChips<T extends string>({
  valor,
  opciones,
  onChange,
}: {
  valor: T
  opciones: { id: T; label: string }[]
  onChange: (id: T) => void
}) {
  return (
    <div className="flex rounded-md border border-[rgba(99,102,241,0.45)] p-0.5">
      {opciones.map((op) => (
        <button
          key={op.id}
          type="button"
          className="h-8 rounded px-3 text-xs font-semibold"
          style={
            valor === op.id
              ? { background: '#6366F1', color: '#fff' }
              : { background: 'transparent', color: '#A5B4FC' }
          }
          onClick={() => onChange(op.id)}
        >
          {op.label}
        </button>
      ))}
    </div>
  )
}

export function GraficoExpandible({
  titulo,
  toolbar,
  compactoClass,
  compactoStyle,
  ocultarTitulo,
  children,
}: {
  titulo: string
  toolbar?: ReactNode
  compactoClass?: string
  compactoStyle?: CSSProperties
  ocultarTitulo?: boolean
  children: ReactNode
}) {
  const [ampliado, setAmpliado] = useState(false)

  useEffect(() => {
    if (!ampliado) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setAmpliado(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [ampliado])

  const boton = (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[rgba(99,102,241,0.45)] text-[#A5B4FC] hover:bg-white/5"
      aria-label="Maximizar gráfico"
      onClick={() => setAmpliado(true)}
    >
      <MaximizeIcon className="h-4 w-4" />
    </button>
  )

  return (
    <>
      <div className="relative">
        <div className="mb-2 flex items-center justify-between gap-2">
          {ocultarTitulo ? <span /> : (
            <p className="min-w-0 text-xs font-medium" style={{ color: 'var(--text-muted, #94A3B8)' }}>
              {titulo}
            </p>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {toolbar}
            {boton}
          </div>
        </div>
        <div className={compactoClass ?? 'h-full'} style={compactoStyle}>
          {children}
        </div>
      </div>
      {ampliado ? (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'rgba(8,12,20,0.92)' }}
          onClick={() => setAmpliado(false)}
        >
          <div className="flex h-full flex-col px-4 py-4" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 style={{ fontFamily: theme.fontDisplay, fontSize: 22, color: '#F1F5F9', fontWeight: 600 }}>
                {titulo}
              </h3>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-xl text-[#F1F5F9] hover:bg-white/10"
                aria-label="Cerrar"
                onClick={() => setAmpliado(false)}
              >
                ✕
              </button>
            </div>
            <div className="mx-auto" style={{ width: '90vw', height: '80vh' }}>
              {children}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
