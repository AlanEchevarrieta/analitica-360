import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { ParticleNetwork } from '../components/ParticleNetwork'
import { ThemeToggle } from '../lib/tema'

export const authInputClass =
  'auth-input h-11 w-full rounded-md border px-3 text-sm outline-none transition placeholder:text-[#7C73C0] focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]'

export const authInputWithIconClass = `${authInputClass} pl-10`

export function AuthLayout({
  children,
  tabs = false,
}: {
  children: ReactNode
  tabs?: boolean
}) {
  return (
    <div className="relative min-h-dvh bg-canvas">
      <ParticleNetwork />
      <div className="auth-toggle-float absolute right-4 top-4 z-20 hidden md:block">
        <ThemeToggle />
      </div>
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-10">
        <div
          className="auth-card flex w-full min-h-0 max-w-[440px] flex-col rounded-lg bg-white/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-md md:min-h-[820px] md:p-10"
          style={{ fontFamily: 'Inter, system-ui, sans-serif', width: 'min(440px, 100%)' }}
        >
          <div className="mb-3 flex justify-end md:hidden">
            <ThemeToggle />
          </div>
          {tabs ? (
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-md bg-[#F1F5F9] p-1 text-sm font-semibold">
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `rounded px-3 py-2 text-center ${isActive ? 'bg-white text-[#1A2F4A] shadow-sm' : 'text-[#64748B]'}`
                }
              >
                Ingresar
              </NavLink>
              <NavLink
                to="/registro"
                className={({ isActive }) =>
                  `rounded px-3 py-2 text-center ${isActive ? 'bg-white text-[#1A2F4A] shadow-sm' : 'text-[#64748B]'}`
                }
              >
                Crear empresa
              </NavLink>
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function UserIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" stroke="#94A3B8" strokeWidth="1.7" />
      <path
        d="M5.5 19.2c.8-3.2 3.3-5 6.5-5s5.7 1.8 6.5 5"
        stroke="#94A3B8"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5.5" y="11" width="13" height="9" rx="2" stroke="#94A3B8" strokeWidth="1.7" />
      <path
        d="M8 11V8.5a4 4 0 0 1 8 0V11"
        stroke="#94A3B8"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function BuildingIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V20" stroke="#94A3B8" strokeWidth="1.7" />
      <path d="M4 20h16M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M9 16h1.5M13.5 16H15" stroke="#94A3B8" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
