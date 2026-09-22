import { SetMetadata } from '@nestjs/common';
import type { AccionClave, ModuloClave } from '../auth/rol.types.js';

export const PERMISO_ACCION_KEY = 'permisoAccion';
export const PERMISO_MODULO_KEY = 'permisoModulo';

/**
 * Requiere una acción granular puntual (mismas claves que
 * src/lib/permisos.ts::AccionClave en el legacy, ej. 'anular_ventas').
 * Dueño siempre pasa; contador solo pasa para 'ver_costos'/'ver_reportes'
 * (ver tieneAccion() en rol.types.ts).
 */
export const RequirePermiso = (accion: AccionClave) => SetMetadata(PERMISO_ACCION_KEY, accion);

/**
 * Requiere acceso a un módulo completo (gate a nivel de controller/ruta,
 * equivalente a tieneModulo()/moduloDeRuta() en el legacy).
 */
export const RequireModulo = (modulo: ModuloClave) => SetMetadata(PERMISO_MODULO_KEY, modulo);
