import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './auth'

export function RequireAuth() {
  const { listo, session, perfil } = useAuth()
  if (!listo) {
    return <p className="p-8 text-center text-sm text-[#8a7a63]">Cargando…</p>
  }
  if (!session) return <Navigate to="/login" replace />
  if (!perfil) return <Navigate to="/completar-alta" replace />
  return <Outlet />
}

export function RequireGuest() {
  const { listo, session, perfil } = useAuth()
  if (!listo) {
    return <p className="p-8 text-center text-sm text-[#8a7a63]">Cargando…</p>
  }
  if (session && !perfil) return <Navigate to="/completar-alta" replace />
  if (session && perfil) return <Navigate to="/" replace />
  return <Outlet />
}

export function RequireDueno() {
  const { listo, session, perfil } = useAuth()
  if (!listo) {
    return <p className="p-8 text-center text-sm text-[#8a7a63]">Cargando…</p>
  }
  if (!session) return <Navigate to="/login" replace />
  if (!perfil) return <Navigate to="/completar-alta" replace />
  if (perfil.usuario.rol !== 'dueno') return <Navigate to="/" replace />
  return <Outlet />
}

export function RequireCompletarAlta() {
  const { listo, session, perfil } = useAuth()
  if (!listo) {
    return <p className="p-8 text-center text-sm text-[#8a7a63]">Cargando…</p>
  }
  if (!session) return <Navigate to="/login" replace />
  if (perfil) return <Navigate to="/" replace />
  return <Outlet />
}
