import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth'
import { planTieneAnalytics } from '../lib/planes'
import { theme } from '../theme'

const linkClass = (tone: 'dark' | 'light', isActive: boolean) => {
  if (tone === 'light') {
    return `rounded-md px-3 py-2 text-sm font-semibold ${
      isActive ? 'bg-[#6366F1] text-white' : 'text-[#6366F1] hover:text-[#4F46E5]'
    }`
  }
  return `rounded-md px-3 py-2 text-sm font-semibold ${
    isActive ? 'bg-white/15 text-white' : 'text-[#A5B4FC] hover:text-white'
  }`
}

export function AppNav({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { perfil } = useAuth()
  const esDueno = perfil?.usuario.rol === 'dueno'

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1" style={{ fontFamily: theme.font }}>
      <NavLink className={({ isActive }) => linkClass(tone, isActive)} to="/" end>
        Inicio
      </NavLink>
      <NavLink className={({ isActive }) => linkClass(tone, isActive)} to="/productos">
        Productos
      </NavLink>
      <NavLink className={({ isActive }) => linkClass(tone, isActive)} to="/ventas">
        Ventas
      </NavLink>
      <NavLink className={({ isActive }) => linkClass(tone, isActive)} to="/clientes">
        Clientes
      </NavLink>
      <NavLink className={({ isActive }) => linkClass(tone, isActive)} to="/compras">
        Compras
      </NavLink>
      <NavLink className={({ isActive }) => linkClass(tone, isActive)} to="/analytics">
        <span className="inline-flex items-center gap-1">
          Analytics
          {perfil && !planTieneAnalytics(perfil.empresa.plan_actual) ? (
            <svg className="h-3.5 w-3.5 opacity-80" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M10 2a4 4 0 00-4 4v2H5a1 1 0 00-1 1v7a1 1 0 001 1h10a1 1 0 001-1V9a1 1 0 00-1-1h-1V6a4 4 0 00-4-4zm2 6V6a2 2 0 10-4 0v2h4z"
                clipRule="evenodd"
              />
            </svg>
          ) : null}
        </span>
      </NavLink>
      {esDueno ? (
        <NavLink className={({ isActive }) => linkClass(tone, isActive)} to="/configuracion">
          Configuración
        </NavLink>
      ) : null}
    </nav>
  )
}
