import type { Rol } from '../types'

export type RolAsignable = 'administrador' | 'operario'

export function parseRol(raw: unknown): Rol {
  const r = String(raw ?? '')
  if (r === 'dueno') return 'dueno'
  if (r === 'administrador') return 'administrador'
  if (r === 'operario' || r === 'operador' || r === 'visor') return 'operario'
  return 'dueno'
}

export function etiquetaRol(rol: string) {
  if (rol === 'dueno') return 'Dueño'
  if (rol === 'administrador') return 'Administrador'
  return 'Operario'
}

export function esDueno(rol: string | undefined) {
  return rol === 'dueno'
}

export function esAdministrador(rol: string | undefined) {
  return rol === 'administrador'
}

export function esOperario(rol: string | undefined) {
  return parseRol(rol) === 'operario'
}

export function puedeConfigurar(rol: string | undefined) {
  return rol === 'dueno' || rol === 'administrador'
}

export function puedeFacturacion(rol: string | undefined) {
  return rol === 'dueno'
}

export function linkInvitacionColaborador(empresaId: string, rol: RolAsignable) {
  const path = `/registro?empresa=${encodeURIComponent(empresaId)}&rol=${encodeURIComponent(rol)}`
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return `${window.location.origin}${path}`
  }
  return `https://analitica360.app${path}`
}

export function textoLinkInvitacion(empresaId: string, rol: RolAsignable) {
  return `analitica360.app/registro?empresa=${empresaId}&rol=${rol}`
}
