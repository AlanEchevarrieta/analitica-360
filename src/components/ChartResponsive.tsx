import { useEffect, useState, type ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

export function useAltoGrafico() {
  const [alto, setAlto] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 220 : 300,
  )
  useEffect(() => {
    function onResize() {
      setAlto(window.innerWidth < 768 ? 220 : 300)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return alto
}

export function propsEjeX(fill: string, categorias = 8) {
  const muchas = categorias > 6
  return {
    tick: { fill, fontSize: 11 },
    axisLine: false as const,
    tickLine: false as const,
    ...(muchas
      ? { angle: -30, textAnchor: 'end' as const, height: 58, interval: 0 as const }
      : {}),
  }
}

export function ChartResponsive({ children }: { children: ReactElement }) {
  const alto = useAltoGrafico()
  return (
    <ResponsiveContainer width="100%" height={alto}>
      {children}
    </ResponsiveContainer>
  )
}
