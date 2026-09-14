import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const TEMA_STORAGE_KEY = 'analitica-tema'
export const TEMA_EVENTO = 'analitica-tema'

export type Tema = 'dark' | 'light'

type TemaCtx = {
  tema: Tema
  setTema: (t: Tema) => void
  toggleTema: () => void
}

const TemaContext = createContext<TemaCtx | null>(null)

export function leerTemaGuardado(): Tema {
  try {
    return localStorage.getItem(TEMA_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function aplicarTema(tema: Tema) {
  const root = document.documentElement
  root.setAttribute('data-theme', tema)
  root.classList.toggle('dark', tema === 'dark')
  try {
    localStorage.setItem(TEMA_STORAGE_KEY, tema)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(TEMA_EVENTO))
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>(() => {
    const inicial = leerTemaGuardado()
    aplicarTema(inicial)
    return inicial
  })

  useEffect(() => {
    aplicarTema(tema)
  }, [tema])

  const value = useMemo<TemaCtx>(
    () => ({
      tema,
      setTema: (nuevoTema: Tema) => {
        aplicarTema(nuevoTema)
        setTemaState(nuevoTema)
      },
      toggleTema: () => {
        const nuevoTema: Tema = tema === 'light' ? 'dark' : 'light'
        aplicarTema(nuevoTema)
        setTemaState(nuevoTema)
      },
    }),
    [tema],
  )

  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>
}

export function useTema() {
  const ctx = useContext(TemaContext)
  if (!ctx) throw new Error('useTema debe usarse dentro de ThemeProvider')
  return ctx
}

const COLORES_GRAFICO_LIGHT = {
  eje: '#1E1B4B',
  grilla: 'rgba(99,102,241,0.15)',
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#6366F1',
  tooltipFg: '#1E1B4B',
  muted: '#3730A3',
} as const

const COLORES_GRAFICO_DARK = {
  eje: '#94A3B8',
  grilla: 'rgba(255,255,255,0.06)',
  tooltipBg: '#1A2F4A',
  tooltipBorder: 'rgba(99,102,241,0.3)',
  tooltipFg: '#ffffff',
  muted: '#94A3B8',
} as const

export function coloresGrafico(tema: Tema) {
  return tema === 'light' ? COLORES_GRAFICO_LIGHT : COLORES_GRAFICO_DARK
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { tema, toggleTema } = useTema()
  const esClaro = tema === 'light'
  return (
    <button
      className={`theme-toggle ${className}`.trim()}
      type="button"
      aria-label={esClaro ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      title={esClaro ? 'Modo claro' : 'Modo oscuro'}
      onClick={toggleTema}
    >
      {esClaro ? '☀️' : '🌙'}
    </button>
  )
}
