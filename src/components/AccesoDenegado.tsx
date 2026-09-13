import { AppNav } from './AppNav'
import { ParticleNetwork } from './ParticleNetwork'
import { theme } from '../theme'

export function AccesoDenegado() {
  return (
    <div
      className="relative min-h-dvh"
      style={{
        fontFamily: theme.font,
        background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})`,
      }}
    >
      <ParticleNetwork />
      <div className="relative z-10 mx-auto max-w-lg px-4 py-8">
        <AppNav />
        <div className="rounded-lg bg-white/95 p-6 text-[#1A2F4A] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <h1 className="text-lg font-bold">No tenés acceso a este módulo.</h1>
          <p className="mt-2 text-sm text-[#4A5568]">Contactá al administrador de tu empresa.</p>
        </div>
      </div>
    </div>
  )
}
