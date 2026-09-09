import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { ThemeToggle } from '../lib/tema'
import { planTieneAnalytics } from '../lib/planes'
import { theme } from '../theme'

function linkClass({ isActive }: { isActive: boolean }) {
  return `app-nav-link${isActive ? ' active' : ''}`
}

function IconoCasa() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10.5 12 4l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
    </svg>
  )
}

function IconoVentas() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7h18M5 7v12a1 1 0 001 1h12a1 1 0 001-1V7M9 11h6" />
    </svg>
  )
}

function IconoCaja() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 8H3l2-4h14l2 4zm-18 0v11a1 1 0 001 1h16a1 1 0 001-1V8" />
    </svg>
  )
}

function IconoPersonas() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M12 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm7 8v-1a4 4 0 00-3-3.87M16.5 7.13a3.5 3.5 0 010 6.74" />
    </svg>
  )
}

function IconoMas() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function CandadoAnalytics({ mostrar }: { mostrar: boolean }) {
  if (!mostrar) return null
  return (
    <svg className="h-3.5 w-3.5 opacity-80" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 2a4 4 0 00-4 4v2H5a1 1 0 00-1 1v7a1 1 0 001 1h10a1 1 0 001-1V9a1 1 0 00-1-1h-1V6a4 4 0 00-4-4zm2 6V6a2 2 0 10-4 0v2h4z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function AppNav() {
  const { perfil, cerrarSesion } = useAuth()
  const esDueno = perfil?.usuario.rol === 'dueno'
  const location = useLocation()
  const [mas, setMas] = useState(false)
  const sinAnalytics = Boolean(perfil && !planTieneAnalytics(perfil.empresa.plan_actual))
  const masActivo = ['/compras', '/proveedores', '/analytics', '/configuracion'].some((p) =>
    location.pathname.startsWith(p),
  )

  useEffect(() => {
    setMas(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mas) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mas])

  return (
    <>
      <div className="mb-4 flex items-center justify-between md:hidden" style={{ fontFamily: theme.font }}>
        <p className="text-sm font-bold tracking-wide" style={{ color: 'var(--text)' }}>
          Analítica 360
        </p>
        <ThemeToggle />
      </div>

      <nav className="app-nav mb-6 hidden items-center gap-1 md:flex" style={{ fontFamily: theme.font }}>
        <NavLink className={linkClass} to="/" end>
          Inicio
        </NavLink>
        <NavLink className={linkClass} to="/productos">
          Productos
        </NavLink>
        <NavLink className={linkClass} to="/ventas">
          Ventas
        </NavLink>
        <NavLink className={linkClass} to="/clientes">
          Clientes
        </NavLink>
        <NavLink className={linkClass} to="/compras">
          Compras
        </NavLink>
        <NavLink className={linkClass} to="/proveedores">
          Proveedores
        </NavLink>
        <NavLink className={linkClass} to="/analytics">
          <span className="inline-flex items-center gap-1">
            Analytics
            <CandadoAnalytics mostrar={sinAnalytics} />
          </span>
        </NavLink>
        {esDueno ? (
          <NavLink className={linkClass} to="/configuracion">
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

      <nav className="app-nav-bottom md:hidden" aria-label="Navegación principal">
        <NavLink className={({ isActive }) => `app-nav-bottom-item${isActive ? ' active' : ''}`} to="/" end>
          <IconoCasa />
          Inicio
        </NavLink>
        <NavLink className={({ isActive }) => `app-nav-bottom-item${isActive ? ' active' : ''}`} to="/ventas">
          <IconoVentas />
          Ventas
        </NavLink>
        <NavLink className={({ isActive }) => `app-nav-bottom-item${isActive ? ' active' : ''}`} to="/productos">
          <IconoCaja />
          Productos
        </NavLink>
        <NavLink className={({ isActive }) => `app-nav-bottom-item${isActive ? ' active' : ''}`} to="/clientes">
          <IconoPersonas />
          Clientes
        </NavLink>
        <button
          className={`app-nav-bottom-item${mas || masActivo ? ' active' : ''}`}
          type="button"
          onClick={() => setMas(true)}
        >
          <IconoMas />
          Más
        </button>
      </nav>

      {mas ? (
        <div className="app-nav-drawer-root md:hidden">
          <button className="app-nav-drawer-bg" type="button" aria-label="Cerrar menú" onClick={() => setMas(false)} />
          <aside className="app-nav-drawer" aria-label="Más secciones">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Más
            </p>
            <NavLink className={linkClass} to="/compras" onClick={() => setMas(false)}>
              Compras
            </NavLink>
            <NavLink className={linkClass} to="/analytics" onClick={() => setMas(false)}>
              <span className="inline-flex items-center gap-1">
                Analytics
                <CandadoAnalytics mostrar={sinAnalytics} />
              </span>
            </NavLink>
            {esDueno ? (
              <NavLink className={linkClass} to="/configuracion" onClick={() => setMas(false)}>
                Configuración
              </NavLink>
            ) : null}
            <NavLink className={linkClass} to="/proveedores" onClick={() => setMas(false)}>
              Proveedores
            </NavLink>
            <button
              className="btn-sesion mt-4 w-full"
              type="button"
              onClick={() => {
                setMas(false)
                void cerrarSesion()
              }}
            >
              Cerrar sesión
            </button>
          </aside>
        </div>
      ) : null}
    </>
  )
}
