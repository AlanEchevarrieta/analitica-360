const SPECIAL = /[!@#$%^&*\-_]/

export type PasswordCheck = {
  minLength: boolean
  upper: boolean
  lower: boolean
  number: boolean
  special: boolean
}

export function evaluarPassword(password: string): PasswordCheck {
  return {
    minLength: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: SPECIAL.test(password),
  }
}

export function passwordValida(check: PasswordCheck): boolean {
  return check.minLength && check.upper && check.lower && check.number && check.special
}

export function requisitosCumplidos(check: PasswordCheck): number {
  return [check.minLength, check.upper, check.lower, check.number, check.special].filter(Boolean)
    .length
}

export function nivelSeguridad(cumplidos: number): {
  segmentos: 0 | 1 | 2 | 3
  etiqueta: string
  color: string
} {
  if (cumplidos <= 2) {
    return { segmentos: cumplidos === 0 ? 0 : 1, etiqueta: 'Seguridad baja', color: '#DC2626' }
  }
  if (cumplidos <= 4) {
    return { segmentos: 2, etiqueta: 'Seguridad media', color: '#D97706' }
  }
  return { segmentos: 3, etiqueta: 'Seguridad alta', color: '#16A34A' }
}
