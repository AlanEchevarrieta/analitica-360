import { useEffect, useState, type ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

export const MARGIN_CHART = { top: 10, right: 20, bottom: 20, left: 10 } as const

export function useEsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  )
  useEffect(() => {
    function onResize() {
      setMobile(window.innerWidth < breakpoint)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return mobile
}

export function useAltoGrafico() {
  return useEsMobile() ? 220 : 320
}

export function tamanoTick(mobile: boolean) {
  return mobile ? 10 : 12
}

export function intervaloEjeX(categorias: number) {
  const n = Math.max(1, categorias)
  if (n <= 8) return 0
  return Math.max(0, Math.ceil(n / 7) - 1)
}

export function propsEjeX(fill: string, categorias = 8, mobile = false) {
  return {
    tick: { fill, fontSize: tamanoTick(mobile) },
    axisLine: false as const,
    tickLine: false as const,
    interval: intervaloEjeX(categorias),
    minTickGap: 12,
    angle: -35,
    textAnchor: 'end' as const,
    height: 50,
  }
}

export function propsEjeY(fill: string, mobile = false) {
  return {
    tick: { fill, fontSize: tamanoTick(mobile) },
    axisLine: false as const,
    tickLine: false as const,
  }
}

export function ChartResponsive({
  children,
  altoMobile,
  altoDesktop,
}: {
  children: ReactElement
  altoMobile?: number
  altoDesktop?: number
}) {
  const mobile = useEsMobile()
  const alto = mobile ? (altoMobile ?? 220) : (altoDesktop ?? 320)
  return (
    <div className="mx-auto w-full overflow-hidden px-1" style={{ minHeight: alto, width: '100%' }}>
      <ResponsiveContainer width="100%" height={alto}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}
