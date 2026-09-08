export type PermisoClave =
  | 'registrar_ventas'
  | 'ver_historial'
  | 'editar_productos'
  | 'ver_costos'
  | 'ajustar_stock'
  | 'ver_reportes'
  | 'anular_ventas'

export type Permisos = Record<PermisoClave, boolean>

export const PERMISOS_OPERADOR: Permisos = {
  registrar_ventas: true,
  ver_historial: true,
  editar_productos: false,
  ver_costos: false,
  ajustar_stock: false,
  ver_reportes: false,
  anular_ventas: false,
}

export const PERMISOS_VISOR: Permisos = {
  registrar_ventas: false,
  ver_historial: true,
  editar_productos: false,
  ver_costos: false,
  ajustar_stock: false,
  ver_reportes: false,
  anular_ventas: false,
}

export const PERMISOS_DUENO: Permisos = {
  registrar_ventas: true,
  ver_historial: true,
  editar_productos: true,
  ver_costos: true,
  ajustar_stock: true,
  ver_reportes: true,
  anular_ventas: true,
}

export const PERMISOS_CAMPOS: { clave: PermisoClave; label: string; nota?: string }[] = [
  { clave: 'registrar_ventas', label: 'Registrar ventas' },
  { clave: 'ver_historial', label: 'Ver historial de ventas' },
  { clave: 'editar_productos', label: 'Agregar y editar productos' },
  { clave: 'ver_costos', label: 'Ver costos y márgenes' },
  { clave: 'ajustar_stock', label: 'Ajustar stock manualmente' },
  { clave: 'ver_reportes', label: 'Ver dashboard y reportes' },
  { clave: 'anular_ventas', label: 'Anular ventas', nota: 'Solo sugerido para Operador avanzado' },
]

export function permisosPorRol(rol: 'operador' | 'visor'): Permisos {
  return rol === 'visor' ? { ...PERMISOS_VISOR } : { ...PERMISOS_OPERADOR }
}

export function parsePermisos(raw: unknown): Permisos {
  const base = { ...PERMISOS_OPERADOR }
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  ;(Object.keys(base) as PermisoClave[]).forEach((clave) => {
    if (typeof obj[clave] === 'boolean') base[clave] = obj[clave]
  })
  return base
}

export function tienePermiso(
  rol: string | undefined,
  permisos: Permisos | null | undefined,
  clave: PermisoClave,
) {
  if (rol === 'dueno') return true
  return Boolean(permisos?.[clave])
}
