/**
 * Puerto (simplificado, solo para gating de UI) de
 * apps/api/src/common/auth/rol.types.ts + usuarios.service.ts::mapearRolClerk.
 * La autorización real vive en el backend (RolesGuard/PermissionsGuard) -
 * esto solo decide qué mostrar en la navegación, nunca qué permitir.
 *
 * Gap conocido, igual que en el backend: el rol 'operador' todavía no tiene
 * persistencia real de accesos granulares por colaborador
 * (AccesoColaborador). Hasta que eso exista, un operador ve el menú
 * completo salvo Configuración (fail-open del lado de la UI - el backend
 * sigue siendo quien bloquea de verdad cualquier acción no permitida).
 */

export type Rol = "dueno" | "operador" | "contador";

export type ModuloClave =
  | "inicio"
  | "productos"
  | "ventas"
  | "clientes"
  | "compras"
  | "proveedores"
  | "pedidos"
  | "inventario"
  | "analytics"
  | "contabilidad"
  | "insights"
  | "configuracion"
  | "soporte";

/** Puerto de mapearRolClerk (apps/api usuarios.service.ts). */
export function rolDesdeClerk(orgRole: string | null | undefined): Rol {
  if (orgRole === "org:admin") return "dueno";
  if (orgRole === "org:contador") return "contador";
  return "operador";
}

/** Módulos fijos de solo lectura del rol contador (invitar_contador() en supabase/070_rol_contador.sql). */
export const MODULOS_CONTADOR: ModuloClave[] = ["inicio", "productos", "ventas", "compras", "analytics", "contabilidad"];

/** Puerto de tieneModulo() (sin AccesoColaborador real todavía, ver nota arriba). */
export function tieneModulo(rol: Rol, modulo: ModuloClave): boolean {
  if (rol === "dueno") return true;
  if (rol === "contador") return MODULOS_CONTADOR.includes(modulo);
  if (modulo === "configuracion") return false;
  return true;
}
