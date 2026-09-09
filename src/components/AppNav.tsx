import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth'
import { ThemeToggle } from '../lib/tema'
import { planTieneAnalytics } from '../lib/planes'
import { theme } from '../theme'

export function AppNav() {
  const { perfil, cerrarSesion } = useAuth()
  const esDueno = perfil?.usuario.rol === 'dueno'

  return (
    <nav className="app-nav mb-6 flex flex-wrap items-center gap-1" style={{ fontFamily: theme.font }}>
      <NavLink className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`} to="/" end>
        Inicio
      </NavLink>
      <NavLink className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`} to="/productos">
        Productos
      </NavLink>
      <NavLink className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`} to="/ventas">
        Ventas
      </NavLink>
      <NavLink className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`} to="/clientes">
        Clientes
      </NavLink>
      <NavLink className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`} to="/compras">
        Compras
      </NavLink>
      <NavLink className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`} to="/proveedores">
        Proveedores
      </NavLink>
      <NavLink className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`} to="/analytics">
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
        <NavLink className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`} to="/configuracion">
          Configuración
        </NavLink>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <button className="btn-sesion" type="button" onClick={() => void cerrarSesion()}>
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
