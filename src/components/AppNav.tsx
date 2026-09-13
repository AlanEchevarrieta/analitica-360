import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { ThemeToggle } from '../lib/tema'
import { planTieneAnalytics, planTieneInsights } from '../lib/planes'
import { requireSupabase, supabase } from '../lib/supabase'
import { contarTicketsNoLeidos, EVENTO_SOPORTE_NOTIF } from '../lib/tickets'
import { tieneModulo } from '../lib/permisos'
import { theme } from '../theme'

function linkClass({ isActive }: { isActive: boolean }) {
  return `app-nav-link${isActive ? ' active' : ''}`
}

function sideClass({ isActive }: { isActive: boolean }) {
  return `app-sidebar-link${isActive ? ' active' : ''}`
}

function sheetClass({ isActive }: { isActive: boolean }) {
  return `app-sheet-link${isActive ? ' active' : ''}`
}

function Candado({ mostrar }: { mostrar: boolean }) {
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

function BadgeNotif({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span className="nav-notif-badge" aria-label={`${n} respuestas nuevas`}>
      {n > 9 ? '9+' : n}
    </span>
  )
}

function NavSep() {
  return <span className="app-nav-sep" role="separator" aria-hidden />
}

function LabelSoporte({ n, emoji }: { n: number; emoji?: boolean }) {
  return (
    <span className="nav-label-con-badge">
      {emoji ? '🎫 Soporte' : 'Soporte'}
      <BadgeNotif n={n} />
    </span>
  )
}

export function AppNav() {
  const { perfil, cerrarSesion } = useAuth()
  const ver = (m: Parameters<typeof tieneModulo>[1]) => tieneModulo(perfil, m)
  const location = useLocation()
  const [mas, setMas] = useState(false)
  const [soporteNuevos, setSoporteNuevos] = useState(0)
  const sinAnalytics = Boolean(perfil && !planTieneAnalytics(perfil.empresa.plan_actual))
  const sinInsights = Boolean(perfil && !planTieneInsights(perfil.empresa.plan_actual))
  const masActivo = [
    '/pedidos',
    '/compras',
    '/proveedores',
    '/analytics',
    '/insights',
    '/configuracion',
    '/inventario',
    '/soporte',
  ].some((p) => location.pathname.startsWith(p))

  useEffect(() => {
    document.body.classList.add('has-app-nav')
    return () => document.body.classList.remove('has-app-nav')
  }, [])

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

  useEffect(() => {
    if (!perfil || !supabase) return
    let vivo = true
    async function cargar() {
      const n = await contarTicketsNoLeidos(requireSupabase())
      if (vivo) setSoporteNuevos(n)
    }
    void cargar()
    const t = window.setInterval(() => void cargar(), 30_000)
    const onEvt = () => void cargar()
    window.addEventListener(EVENTO_SOPORTE_NOTIF, onEvt)
    return () => {
      vivo = false
      window.clearInterval(t)
      window.removeEventListener(EVENTO_SOPORTE_NOTIF, onEvt)
    }
  }, [perfil])

  const analyticsLabel = (
    <span className="inline-flex items-center gap-1">
      Analytics
      <Candado mostrar={sinAnalytics} />
    </span>
  )

  const insightsLabel = (
    <span className="inline-flex items-center gap-1">
      Insights
      <Candado mostrar={sinInsights} />
    </span>
  )

  return (
    <>
      <nav className="app-nav mb-6 hidden lg:flex" style={{ fontFamily: theme.font }} aria-label="Navegación">
        <div className="app-nav-brand">
          <span className="app-nav-brand-name">Analítica 360</span>
          <span className="app-nav-brand-empresa">{perfil?.empresa.nombre ?? ''}</span>
        </div>
        <div className="app-nav-pills">
          {ver('inicio') ? (
            <NavLink className={linkClass} to="/inicio" end>
              Inicio
            </NavLink>
          ) : null}
          {(ver('productos') || ver('ventas') || ver('clientes')) ? <NavSep /> : null}
          {ver('productos') ? (
            <NavLink className={linkClass} to="/productos">
              Productos
            </NavLink>
          ) : null}
          {ver('ventas') ? (
            <NavLink className={linkClass} to="/ventas">
              Ventas
            </NavLink>
          ) : null}
          {ver('clientes') ? (
            <NavLink className={linkClass} to="/clientes">
              Clientes
            </NavLink>
          ) : null}
          {(ver('compras') || ver('pedidos') || ver('proveedores') || ver('inventario')) ? <NavSep /> : null}
          {ver('compras') ? (
            <NavLink className={linkClass} to="/compras">
              Compras
            </NavLink>
          ) : null}
          {ver('pedidos') ? (
            <NavLink className={linkClass} to="/pedidos">
              Pedidos
            </NavLink>
          ) : null}
          {ver('proveedores') ? (
            <NavLink className={linkClass} to="/proveedores">
              Proveedores
            </NavLink>
          ) : null}
          {ver('inventario') ? (
            <NavLink className={linkClass} to="/inventario">
              Inventario
            </NavLink>
          ) : null}
          {(ver('analytics') || ver('insights')) ? <NavSep /> : null}
          {ver('analytics') ? (
            <NavLink className={linkClass} to="/analytics">
              {analyticsLabel}
            </NavLink>
          ) : null}
          {ver('insights') ? (
            <NavLink className={linkClass} to="/insights">
              {insightsLabel}
            </NavLink>
          ) : null}
          <NavSep />
          <NavLink className={linkClass} to="/soporte">
            <LabelSoporte n={soporteNuevos} />
          </NavLink>
          {ver('configuracion') ? (
            <NavLink className={linkClass} to="/configuracion">
              Configuración
            </NavLink>
          ) : null}
        </div>
        <div className="app-nav-actions">
          <ThemeToggle />
          <button className="btn-sesion" type="button" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* Tablet 768–1024: sidebar */}
      <aside className="app-sidebar hidden md:flex lg:hidden" aria-label="Navegación">
        <p className="app-sidebar-brand">Analítica 360</p>
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {ver('inicio') ? (
            <NavLink className={sideClass} to="/inicio" end>
              🏠 Inicio
            </NavLink>
          ) : null}
          {ver('ventas') ? (
            <NavLink className={sideClass} to="/ventas">
              💸 Ventas
            </NavLink>
          ) : null}
          {ver('productos') ? (
            <NavLink className={sideClass} to="/productos">
              📦 Productos
            </NavLink>
          ) : null}
          {ver('clientes') ? (
            <NavLink className={sideClass} to="/clientes">
              👥 Clientes
            </NavLink>
          ) : null}
          {ver('compras') ? (
            <NavLink className={sideClass} to="/compras">
              🛒 Compras
            </NavLink>
          ) : null}
          {ver('pedidos') ? (
            <NavLink className={sideClass} to="/pedidos">
              📤 Pedidos
            </NavLink>
          ) : null}
          {ver('proveedores') ? (
            <NavLink className={sideClass} to="/proveedores">
              🏭 Proveedores
            </NavLink>
          ) : null}
          {ver('inventario') ? (
            <NavLink className={sideClass} to="/inventario">
              📋 Inventario
            </NavLink>
          ) : null}
          <NavLink className={sideClass} to="/soporte">
            <LabelSoporte n={soporteNuevos} emoji />
          </NavLink>
          {ver('analytics') ? (
            <NavLink className={sideClass} to="/analytics">
              📊 {analyticsLabel}
            </NavLink>
          ) : null}
          {ver('insights') ? (
            <NavLink className={sideClass} to="/insights">
              ✨ {insightsLabel}
            </NavLink>
          ) : null}
          {ver('configuracion') ? (
            <NavLink className={sideClass} to="/configuracion">
              ⚙️ Configuración
            </NavLink>
          ) : null}
        </div>
        <div className="mt-auto flex flex-col gap-2 border-t border-[rgba(99,102,241,0.2)] pt-3">
          <ThemeToggle />
          <button className="btn-sesion w-full" type="button" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile: bottom bar */}
      <nav className="app-nav-bottom md:hidden" aria-label="Navegación principal">
        {ver('inicio') ? (
          <NavLink className={({ isActive }) => `app-nav-bottom-item${isActive ? ' active' : ''}`} to="/inicio" end>
            <span aria-hidden>🏠</span>
            Inicio
          </NavLink>
        ) : null}
        {ver('ventas') ? (
          <NavLink className={({ isActive }) => `app-nav-bottom-item${isActive ? ' active' : ''}`} to="/ventas">
            <span aria-hidden>💸</span>
            Ventas
          </NavLink>
        ) : null}
        {ver('productos') ? (
          <NavLink className={({ isActive }) => `app-nav-bottom-item${isActive ? ' active' : ''}`} to="/productos">
            <span aria-hidden>📦</span>
            Productos
          </NavLink>
        ) : null}
        {ver('clientes') ? (
          <NavLink className={({ isActive }) => `app-nav-bottom-item${isActive ? ' active' : ''}`} to="/clientes">
            <span aria-hidden>👥</span>
            Clientes
          </NavLink>
        ) : null}
        <button
          className={`app-nav-bottom-item${mas || masActivo ? ' active' : ''}`}
          type="button"
          onClick={() => setMas(true)}
        >
          <span className="relative inline-block" aria-hidden>
            ☰
            <BadgeNotif n={soporteNuevos} />
          </span>
          Más
        </button>
      </nav>

      {mas ? (
        <div className="app-nav-drawer-root md:hidden">
          <button className="app-nav-drawer-bg" type="button" aria-label="Cerrar menú" onClick={() => setMas(false)} />
          <aside className="app-nav-sheet" aria-label="Más secciones">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            {ver('compras') ? (
              <NavLink className={sheetClass} to="/compras" onClick={() => setMas(false)}>
                🛒 Compras
              </NavLink>
            ) : null}
            {ver('pedidos') ? (
              <NavLink className={sheetClass} to="/pedidos" onClick={() => setMas(false)}>
                📤 Pedidos
              </NavLink>
            ) : null}
            {ver('proveedores') ? (
              <NavLink className={sheetClass} to="/proveedores" onClick={() => setMas(false)}>
                🏭 Proveedores
              </NavLink>
            ) : null}
            {ver('inventario') ? (
              <NavLink className={sheetClass} to="/inventario" onClick={() => setMas(false)}>
                📋 Inventario
              </NavLink>
            ) : null}
            <NavLink className={sheetClass} to="/soporte" onClick={() => setMas(false)}>
              <LabelSoporte n={soporteNuevos} emoji />
            </NavLink>
            {ver('analytics') ? (
              <NavLink className={sheetClass} to="/analytics" onClick={() => setMas(false)}>
                📊 {analyticsLabel}
              </NavLink>
            ) : null}
            {ver('insights') ? (
              <NavLink className={sheetClass} to="/insights" onClick={() => setMas(false)}>
                ✨ {insightsLabel}
              </NavLink>
            ) : null}
            {ver('configuracion') ? (
              <NavLink className={sheetClass} to="/configuracion" onClick={() => setMas(false)}>
                ⚙️ Configuración
              </NavLink>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgba(99,102,241,0.2)] pt-3">
              <span className="text-sm" style={{ color: '#94A3B8' }}>
                Tema
              </span>
              <ThemeToggle />
            </div>
            <button
              className="btn-sesion mt-3 w-full"
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
