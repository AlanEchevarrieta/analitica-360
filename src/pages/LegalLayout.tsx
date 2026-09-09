import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { ThemeToggle } from '../lib/tema'

export function LegalLayout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="relative min-h-dvh bg-canvas">
      <ParticleNetwork />
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      <div className="relative z-10 mx-auto max-w-[640px] px-4 py-10">
        <article
          className="rounded-lg bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-md"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          <p className="text-center text-sm font-semibold text-[#6366F1]">Analítica 360</p>
          <h1 className="mt-2 text-center text-[22px] font-bold text-[#1A2F4A]">{title}</h1>
          <p className="mt-1 text-center text-xs text-[#94A3B8]">Versión 1.0</p>
          <div className="mt-8 space-y-5 text-sm leading-relaxed text-[#4A5568]">{children}</div>
          <p className="mt-10 text-center text-sm">
            <Link className="font-medium text-[#6366F1] hover:text-[#4F46E5]" to="/registro">
              Volver al registro
            </Link>
          </p>
        </article>
      </div>
    </div>
  )
}
