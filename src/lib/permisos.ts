import type { SupabaseClient } from '@supabase/supabase-js'

export type ModuloClave =
  | 'inicio'
  | 'productos'
  | 'ventas'
  | 'clientes'
  | 'compras'
  | 'proveedores'
  | 'pedidos'
  | 'inventario'
  | 'analytics'
  | 'insights'
  | 'configuracion'

export type AccionClave =
  | 'registrar_ventas'
  | 'crear_pedidos'
  | 'hacer_picking'
  | 'editar_productos'
  | 'ver_costos'
  | 'anular_ventas'
  | 'importar_datos'
  | 'ver_reportes'
  | 'gestionar_clientes'

export type AccesoColaborador = {
  modulos: Record<ModuloClave, boolean>
  acciones: Record<AccionClave, boolean>
}

export const MODULOS_EQUIPO: { id: ModuloClave; icono: string; label: string; soloDueno?: boolean }[] = [
  { id: 'inicio', icono: '🏠', label: 'Inicio' },
  { id: 'productos', icono: '📦', label: 'Productos' },
  { id: 'ventas', icono: '💰', label: 'Ventas' },
  { id: 'clientes', icono: '👥', label: 'Clientes' },
  { id: 'compras', icono: '🛒', label: 'Compras' },
  { id: 'proveedores', icono: '🏭', label: 'Proveedores' },
  { id: 'pedidos', icono: '📋', label: 'Pedidos' },
  { id: 'inventario', icono: '🏗️', label: 'Inventario' },
  { id: 'analytics', icono: '📊', label: 'Analytics' },
  { id: 'insights', icono: '💡', label: 'Insights' },
  { id: 'configuracion', icono: '⚙️', label: 'Configuración', soloDueno: true },
]

export const ACCIONES_EQUIPO: { id: AccionClave; label: string }[] = [
  { id: 'registrar_ventas', label: 'Registrar ventas' },
  { id: 'crear_pedidos', label: 'Crear y gestionar pedidos' },
  { id: 'hacer_picking', label: 'Hacer picking de pedidos' },
  { id: 'editar_productos', label: 'Editar y eliminar productos' },
  { id: 'ver_costos', label: 'Ver precios de costo' },
  { id: 'anular_ventas', label: 'Anular ventas y compras' },
  { id: 'importar_datos', label: 'Importar datos masivos' },
  { id: 'ver_reportes', label: 'Ver reportes financieros' },
  { id: 'gestionar_clientes', label: 'Gestionar clientes' },
]

function mapaFalse<T extends string>(claves: T[]): Record<T, boolean> {
  return Object.fromEntries(claves.map((k) => [k, false])) as Record<T, boolean>
}

function mapaTrue<T extends string>(claves: T[]): Record<T, boolean> {
  return Object.fromEntries(claves.map((k) => [k, true])) as Record<T, boolean>
}

const MODULO_IDS = MODULOS_EQUIPO.map((m) => m.id)
const ACCION_IDS = ACCIONES_EQUIPO.map((a) => a.id)

export function accesoVacio(): AccesoColaborador {
  return { modulos: mapaFalse(MODULO_IDS), acciones: mapaFalse(ACCION_IDS) }
}

export function accesoTotal(incluirConfig = false): AccesoColaborador {
  const acceso = {
    modulos: mapaTrue(MODULO_IDS),
    acciones: mapaTrue(ACCION_IDS),
  }
  if (!incluirConfig) acceso.modulos.configuracion = false
  return acceso
}

export function accesoSoloPedidos(): AccesoColaborador {
  const acceso = accesoVacio()
  acceso.modulos.inicio = true
  acceso.modulos.pedidos = true
  acceso.acciones.crear_pedidos = true
  acceso.acciones.hacer_picking = true
  return acceso
}

export function accesoSoloVentas(): AccesoColaborador {
  const acceso = accesoVacio()
  acceso.modulos.inicio = true
  acceso.modulos.ventas = true
  acceso.modulos.productos = true
  acceso.modulos.clientes = true
  acceso.acciones.registrar_ventas = true
  acceso.acciones.gestionar_clientes = true
  return acceso
}

export type PresetPermiso = 'completo' | 'pedidos' | 'ventas' | 'personalizado'

export function detectarPreset(acceso: AccesoColaborador): PresetPermiso {
  const n = parseAcceso(acceso.modulos, acceso.acciones)
  if (JSON.stringify(n) === JSON.stringify(accesoTotal(false))) return 'completo'
  if (JSON.stringify(n) === JSON.stringify(accesoSoloPedidos())) return 'pedidos'
  if (JSON.stringify(n) === JSON.stringify(accesoSoloVentas())) return 'ventas'
  return 'personalizado'
}

export function parseAcceso(modulosRaw: unknown, accionesRaw: unknown): AccesoColaborador {
  const base = accesoVacio()
  if (modulosRaw && typeof modulosRaw === 'object' && !Array.isArray(modulosRaw)) {
    const obj = modulosRaw as Record<string, unknown>
    for (const id of MODULO_IDS) {
      if (typeof obj[id] === 'boolean') base.modulos[id] = obj[id]
    }
  }
  if (accionesRaw && typeof accionesRaw === 'object' && !Array.isArray(accionesRaw)) {
    const obj = accionesRaw as Record<string, unknown>
    for (const id of ACCION_IDS) {
      if (typeof obj[id] === 'boolean') base.acciones[id] = obj[id]
    }
  }
  base.modulos.configuracion = false
  return base
}

export function esDuenoPerfil(rol: string | undefined) {
  return rol === 'dueno'
}

export function tieneModulo(
  perfil: { usuario: { rol: string; acceso?: AccesoColaborador } } | null | undefined,
  modulo: ModuloClave,
) {
  if (!perfil) return false
  if (esDuenoPerfil(perfil.usuario.rol)) return true
  if (modulo === 'configuracion') return false
  return Boolean(perfil.usuario.acceso?.modulos[modulo])
}

export function tieneAccion(
  perfil: { usuario: { rol: string; acceso?: AccesoColaborador } } | null | undefined,
  accion: AccionClave,
) {
  if (!perfil) return false
  if (esDuenoPerfil(perfil.usuario.rol)) return true
  return Boolean(perfil.usuario.acceso?.acciones[accion])
}

/** Compatibilidad con llamadas viejas. */
export type PermisoClave = AccionClave | 'ver_historial' | 'ajustar_stock'

export type Permisos = Record<string, boolean>

export function tienePermiso(
  perfil: { usuario: { rol: string; acceso?: AccesoColaborador } } | null | undefined,
  clave: PermisoClave,
) {
  if (clave === 'ver_historial') return tieneModulo(perfil, 'ventas')
  if (clave === 'ajustar_stock') return tieneModulo(perfil, 'inventario')
  return tieneAccion(perfil, clave)
}

export const RUTA_MODULO: { prefix: string; modulo: ModuloClave }[] = [
  { prefix: '/productos', modulo: 'productos' },
  { prefix: '/ventas', modulo: 'ventas' },
  { prefix: '/clientes', modulo: 'clientes' },
  { prefix: '/compras', modulo: 'compras' },
  { prefix: '/proveedores', modulo: 'proveedores' },
  { prefix: '/pedidos', modulo: 'pedidos' },
  { prefix: '/inventario', modulo: 'inventario' },
  { prefix: '/analytics', modulo: 'analytics' },
  { prefix: '/insights', modulo: 'insights' },
  { prefix: '/configuracion', modulo: 'configuracion' },
  { prefix: '/inicio', modulo: 'inicio' },
]

export function moduloDeRuta(pathname: string): ModuloClave | null {
  const hit = RUTA_MODULO.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`))
  return hit?.modulo ?? null
}

export async function leerAccesoColaborador(
  client: SupabaseClient,
  usuarioId: string,
  rol: string,
): Promise<AccesoColaborador> {
  if (rol === 'dueno') return accesoTotal(true)
  const { data } = await client
    .from('colaborador_permisos')
    .select('modulos, acciones')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (data) return parseAcceso(data.modulos, data.acciones)
  if (rol === 'administrador') return accesoTotal(false)
  return accesoSoloPedidos()
}
