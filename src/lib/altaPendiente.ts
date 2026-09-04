const KEY = 'analitica.alta-pendiente'

export type AltaPendiente = {
  nombreEmpresa: string
  rubro: string
  nombreUsuario: string
}

export function guardarAltaPendiente(data: AltaPendiente) {
  sessionStorage.setItem(KEY, JSON.stringify(data))
}

export function leerAltaPendiente(): AltaPendiente | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AltaPendiente
  } catch {
    return null
  }
}

export function limpiarAltaPendiente() {
  sessionStorage.removeItem(KEY)
}
