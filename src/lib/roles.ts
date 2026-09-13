import type { Rol } from '../types'

export function parseRol(raw: unknown): Rol {
  const r = String(raw ?? '')
  if (r === 'dueno') return 'dueno'
  if (r === 'administrador') return 'administrador'
  if (r === 'operario' || r === 'operador' || r === 'visor') return 'operario'
  return 'dueno'
}

export function esDueno(rol: string | undefined) {
  return rol === 'dueno'
}

export function linkInvitacionColaborador(empresaId: string, rol = 'operario') {
  const id = encodeURIComponent(empresaId)
  const r = encodeURIComponent(rol)
  const path = `/registro?empresa=${id}&rol=${r}`
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return `${window.location.origin}${path}`
  }
  return `https://analitica360.app${path}`
}

export function textoLinkInvitacion(empresaId: string, rol = 'operario') {
  return `analitica360.app/registro?empresa=${empresaId}&rol=${rol}`
}
