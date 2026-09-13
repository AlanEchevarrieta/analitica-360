import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { AccesoDenegado } from './components/AccesoDenegado'
import { esDueno } from './lib/roles'
import { moduloDeRuta, tieneModulo, type ModuloClave } from './lib/permisos'

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
  if (session && perfil) return <Navigate to="/inicio" replace />
  return <Outlet />
}

export function RequireDueno() {
  const { listo, session, perfil } = useAuth()
  if (!listo) {
    return <p className="p-8 text-center text-sm text-[#8a7a63]">Cargando…</p>
  }
  if (!session) return <Navigate to="/login" replace />
  if (!perfil) return <Navigate to="/completar-alta" replace />
  if (!esDueno(perfil.usuario.rol)) return <AccesoDenegado />
  return <Outlet />
}

export function RequireModulo({ modulo }: { modulo: ModuloClave }) {
  const { listo, session, perfil } = useAuth()
  if (!listo) {
    return <p className="p-8 text-center text-sm text-[#8a7a63]">Cargando…</p>
  }
  if (!session) return <Navigate to="/login" replace />
  if (!perfil) return <Navigate to="/completar-alta" replace />
  if (!tieneModulo(perfil, modulo)) return <AccesoDenegado />
  return <Outlet />
}

export function GateModulos() {
  const { perfil } = useAuth()
  const location = useLocation()
  const modulo = moduloDeRuta(location.pathname)
  if (modulo && perfil && !tieneModulo(perfil, modulo)) return <AccesoDenegado />
  return <Outlet />
}

export function RequireCompletarAlta() {
  const { listo, session, perfil } = useAuth()
  if (!listo) {
    return <p className="p-8 text-center text-sm text-[#8a7a63]">Cargando…</p>
  }
  if (!session) return <Navigate to="/login" replace />
  if (perfil) return <Navigate to="/inicio" replace />
  return <Outlet />
}
