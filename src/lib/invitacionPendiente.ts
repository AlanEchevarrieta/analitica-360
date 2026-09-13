const KEY = 'analitica.invitacion-equipo'

export type InvitacionPendiente = {
  empresaId: string
  rol: 'administrador' | 'operario'
  nombreUsuario: string
}

export function guardarInvitacionPendiente(data: InvitacionPendiente) {
  sessionStorage.setItem(KEY, JSON.stringify(data))
}

export function leerInvitacionPendiente(): InvitacionPendiente | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as InvitacionPendiente
  } catch {
    return null
  }
}

export function limpiarInvitacionPendiente() {
  sessionStorage.removeItem(KEY)
}
