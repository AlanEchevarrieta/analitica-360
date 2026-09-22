// Puerto directo de src/lib/roles.ts + src/lib/permisos.ts (legacy) y de la
// función SQL get_rol() (supabase/070_rol_contador.sql), que es la fuente de
// verdad de la normalización de roles:
//
//   SELECT CASE rol
//     WHEN 'administrador' THEN 'dueno'
//     WHEN 'operario' THEN 'operador'
//     ELSE rol
//   END
//
// El valor crudo en BD tiene 4 variantes históricas (dueno, administrador,
// operario, contador) pero funcionalmente solo hay 3 roles. Todo el sistema
// nuevo debe operar sobre el valor NORMALIZADO (Rol), nunca sobre el crudo.

export type RolCrudo = 'dueno' | 'administrador' | 'operario' | 'operador' | 'contador' | 'visor';
export type Rol = 'dueno' | 'operador' | 'contador';

export function normalizarRol(rolCrudo: string | null | undefined): Rol {
  switch (rolCrudo) {
    case 'dueno':
      return 'dueno';
    case 'administrador':
      return 'dueno';
    case 'operario':
      return 'operador';
    case 'operador':
      return 'operador';
    case 'visor':
      return 'operador';
    case 'contador':
      return 'contador';
    default:
      // Mismo fallback que parseRol() en el legacy: ante un valor
      // desconocido, no se asume el rol de mayor privilegio salvo que sea
      // explícito — acá se prefiere el más restrictivo posible.
      return 'operador';
  }
}

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
  | 'contabilidad'
  | 'insights'
  | 'configuracion';

export type AccionClave =
  | 'registrar_ventas'
  | 'crear_pedidos'
  | 'hacer_picking'
  | 'editar_productos'
  | 'ver_costos'
  | 'anular_ventas'
  | 'importar_datos'
  | 'ver_reportes'
  | 'gestionar_clientes';

export const MODULOS: ModuloClave[] = [
  'inicio',
  'productos',
  'ventas',
  'clientes',
  'compras',
  'proveedores',
  'pedidos',
  'inventario',
  'analytics',
  'contabilidad',
  'insights',
  'configuracion',
];

export const ACCIONES: AccionClave[] = [
  'registrar_ventas',
  'crear_pedidos',
  'hacer_picking',
  'editar_productos',
  'ver_costos',
  'anular_ventas',
  'importar_datos',
  'ver_reportes',
  'gestionar_clientes',
];

// Módulos/acciones fijos del rol "contador" (invitar_contador() en
// 070_rol_contador.sql) — solo lectura, no configurable por el dueño.
export const MODULOS_CONTADOR: ModuloClave[] = [
  'inicio',
  'productos',
  'ventas',
  'compras',
  'analytics',
  'contabilidad',
];
export const ACCIONES_CONTADOR: AccionClave[] = ['ver_costos', 'ver_reportes'];

export type AccesoColaborador = {
  modulos: Record<ModuloClave, boolean>;
  acciones: Record<AccionClave, boolean>;
};

/**
 * Resuelve si un usuario tiene acceso a un módulo, replicando tieneModulo()
 * del legacy: dueño = todo, contador = lista fija de solo lectura,
 * operador = según AccesoColaborador (TODO Fase 3: persistencia real en
 * Postgres — hoy la fuente de datos es el repositorio en memoria de
 * PermissionsGuard).
 */
export function tieneModulo(rol: Rol, modulo: ModuloClave, acceso?: AccesoColaborador): boolean {
  if (rol === 'dueno') return true;
  if (rol === 'contador') return MODULOS_CONTADOR.includes(modulo);
  if (modulo === 'configuracion') return false;
  return Boolean(acceso?.modulos[modulo]);
}

export function tieneAccion(rol: Rol, accion: AccionClave, acceso?: AccesoColaborador): boolean {
  if (rol === 'dueno') return true;
  if (rol === 'contador') return ACCIONES_CONTADOR.includes(accion);
  return Boolean(acceso?.acciones[accion]);
}
