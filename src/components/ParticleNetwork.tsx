import { useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

const MIN_WIDTH = 768
const COUNT = 120
const LINK_DIST = 130
const MOUSE_RADIUS = 150

function speed() {
  return 0.6 + Math.random() * 0.6
}

function createParticles(width: number, height: number, count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const s = speed()
    const angle = Math.random() * Math.PI * 2
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s,
      r: 2 + Math.random(),
    }
  })
}

function shouldAnimate(enableMobile: boolean) {
  if (typeof window === 'undefined') return false
  if (!enableMobile && window.innerWidth < MIN_WIDTH) return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return true
}

function leerColores() {
  const s = getComputedStyle(document.documentElement)
  const r = Number.parseFloat(s.getPropertyValue('--particle-r').trim())
  return {
    from: s.getPropertyValue('--canvas-from').trim() || '#0F1B2D',
    to: s.getPropertyValue('--canvas-to').trim() || '#1A2F4A',
    dot: s.getPropertyValue('--particle').trim() || 'rgba(99,179,237,0.7)',
    line: s.getPropertyValue('--particle-line').trim() || 'rgba(99,179,237,0.25)',
    fill: s.getPropertyValue('--particle-fill').trim() !== '0',
    radius: Number.isFinite(r) && r > 0 ? r : 0,
  }
}

export function ParticleNetwork({
  contained = false,
  enableMobile = false,
  mobileCount = 80,
  desktopCount = COUNT,
  startWhenIdle = false,
}: {
  contained?: boolean
  enableMobile?: boolean
  mobileCount?: number
  desktopCount?: number
  startWhenIdle?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const surface = canvasRef.current
    if (!surface) return

    const gfx = surface.getContext('2d')
    if (!gfx) return
    const board: HTMLCanvasElement = surface
    const brush: CanvasRenderingContext2D = gfx

    let particles: Particle[] = []
    let raf = 0
    let running = false
    let colors = leerColores()
    const mouse = { x: 0, y: 0, active: false }

    function medidas() {
      const parent = board.parentElement
      if (contained && parent) {
        return { width: parent.clientWidth, height: parent.clientHeight }
      }
      return { width: window.innerWidth, height: window.innerHeight }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { width, height } = medidas()
      board.width = Math.floor(width * dpr)
      board.height = Math.floor(height * dpr)
      board.style.width = `${width}px`
      board.style.height = `${height}px`
      brush.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = width < MIN_WIDTH ? mobileCount : desktopCount
      particles = createParticles(width, height, count)
    }

    function draw() {
      colors = leerColores()
      const { width, height } = medidas()
      if (colors.fill) {
        const g = brush.createLinearGradient(0, 0, 0, height)
        g.addColorStop(0, colors.from)
        g.addColorStop(1, colors.to)
        brush.fillStyle = g
        brush.fillRect(0, 0, width, height)
      } else {
        brush.clearRect(0, 0, width, height)
      }

      for (const p of particles) {
        if (mouse.active) {
          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const dist = Math.hypot(dx, dy)
          if (dist < MOUSE_RADIUS && dist > 0.001) {
            p.vx += (dx / dist) * 0.04
            p.vy += (dy / dist) * 0.04
          }
        }

        const mag = Math.hypot(p.vx, p.vy) || 1
        const cap = 1.2
        if (mag > cap) {
          p.vx = (p.vx / mag) * cap
          p.vy = (p.vy / mag) * cap
        }

        p.x += p.vx
        p.y += p.vy

        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1
        p.x = Math.min(width, Math.max(0, p.x))
        p.y = Math.min(height, Math.max(0, p.y))
      }

      brush.strokeStyle = colors.line
      brush.lineWidth = 1
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < LINK_DIST) {
            brush.globalAlpha = 1 - dist / LINK_DIST
            brush.beginPath()
            brush.moveTo(a.x, a.y)
            brush.lineTo(b.x, b.y)
            brush.stroke()
          }
        }
      }
      brush.globalAlpha = 1

      brush.fillStyle = colors.dot
      for (const p of particles) {
        brush.beginPath()
        brush.arc(p.x, p.y, colors.radius || p.r, 0, Math.PI * 2)
        brush.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    function start() {
      if (running || !shouldAnimate(enableMobile)) return
      running = true
      resize()
      raf = requestAnimationFrame(draw)
    }

    function stop() {
      running = false
      cancelAnimationFrame(raf)
    }

    function onMove(e: MouseEvent) {
      if (contained) {
        const rect = board.getBoundingClientRect()
        mouse.x = e.clientX - rect.left
        mouse.y = e.clientY - rect.top
      } else {
        mouse.x = e.clientX
        mouse.y = e.clientY
      }
      mouse.active = true
    }

    function onLeave() {
      mouse.active = false
    }

    function onResize() {
      stop()
      if (shouldAnimate(enableMobile)) start()
    }

    function onVisibility() {
      if (document.hidden) stop()
      else if (shouldAnimate(enableMobile)) start()
    }

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    motion.addEventListener('change', onResize)
    window.addEventListener('resize', onResize)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)

    if (startWhenIdle) {
      const arrancar = () => {
        if (shouldAnimate(enableMobile)) start()
      }
      let cancelIdle: () => void
      if (typeof window.requestIdleCallback === 'function') {
        const idleId = window.requestIdleCallback(arrancar, { timeout: 500 })
        cancelIdle = () => window.cancelIdleCallback(idleId)
      } else {
        const t = window.setTimeout(arrancar, 500)
        cancelIdle = () => window.clearTimeout(t)
      }
      return () => {
        cancelIdle()
        stop()
        motion.removeEventListener('change', onResize)
        window.removeEventListener('resize', onResize)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseleave', onLeave)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }

    if (shouldAnimate(enableMobile)) start()

    return () => {
      stop()
      motion.removeEventListener('change', onResize)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [contained, enableMobile, mobileCount, desktopCount, startWhenIdle])

  const vis = enableMobile ? 'block' : 'hidden md:block'
  return (
    <canvas
      ref={canvasRef}
      width={390}
      height={844}
      aria-hidden="true"
      className={
        contained
          ? `pointer-events-none absolute inset-0 z-0 h-full w-full ${vis}`
          : `pointer-events-none fixed top-0 left-0 z-0 h-[100vh] w-[100vw] ${vis}`
      }
    />
  )
}
