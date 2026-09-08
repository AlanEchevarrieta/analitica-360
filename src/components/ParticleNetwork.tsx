import { useEffect, useRef } from 'react'
import { theme } from '../theme'

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

const DOT = theme.particle
const LINE = theme.particleLine

function speed() {
  return 0.6 + Math.random() * 0.6
}

function createParticles(width: number, height: number): Particle[] {
  return Array.from({ length: COUNT }, () => {
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

function shouldAnimate() {
  if (typeof window === 'undefined') return false
  if (window.innerWidth < MIN_WIDTH) return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return true
}

export function ParticleNetwork() {
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
    const mouse = { x: 0, y: 0, active: false }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = window.innerWidth
      const height = window.innerHeight
      board.width = Math.floor(width * dpr)
      board.height = Math.floor(height * dpr)
      board.style.width = `${width}px`
      board.style.height = `${height}px`
      brush.setTransform(dpr, 0, 0, dpr, 0, 0)
      particles = createParticles(width, height)
    }

    function draw() {
      const width = window.innerWidth
      const height = window.innerHeight
      const g = brush.createLinearGradient(0, 0, 0, height)
      g.addColorStop(0, theme.canvasFrom)
      g.addColorStop(1, theme.canvasTo)
      brush.fillStyle = g
      brush.fillRect(0, 0, width, height)

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

      brush.strokeStyle = LINE
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

      brush.fillStyle = DOT
      for (const p of particles) {
        brush.beginPath()
        brush.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        brush.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    function start() {
      if (running || !shouldAnimate()) return
      running = true
      resize()
      raf = requestAnimationFrame(draw)
    }

    function stop() {
      running = false
      cancelAnimationFrame(raf)
    }

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = true
    }

    function onLeave() {
      mouse.active = false
    }

    function onResize() {
      stop()
      if (shouldAnimate()) start()
    }

    function onVisibility() {
      if (document.hidden) stop()
      else if (shouldAnimate()) start()
    }

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    motion.addEventListener('change', onResize)
    window.addEventListener('resize', onResize)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)

    if (shouldAnimate()) start()

    return () => {
      stop()
      motion.removeEventListener('change', onResize)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 hidden h-full w-full md:block"
    />
  )
}
