/** Registro propio con prueba gratis: reglas puras. */

export const DIAS_PRUEBA = 14;
/** Durante la prueba se usan todas las funciones (plan más completo sin tienda). */
export const PLAN_PRUEBA = 'premium';

/** Fecha (YYYY-MM-DD) en que termina la prueba empezando `hoy` (día AR). */
export function finDePrueba(hoy: string, dias = DIAS_PRUEBA): string {
  const [y, m, d] = hoy.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Nombre del negocio prolijo: sin espacios de más. */
export function limpiarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

/** WhatsApp en formato internacional argentino (549 + área + número) si se puede, si no como vino. */
export function normalizarTelefono(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  if (/^549\d{10}$/.test(digitos)) return digitos;
  if (/^54\d{10}$/.test(digitos)) return `549${digitos.slice(2)}`;
  // 0261 15 5469432 -> 261 5469432
  const local = digitos.replace(/^0/, '');
  const sin15 = local.length === 12 && local.slice(3, 5) === '15' ? local.slice(0, 3) + local.slice(5) : local;
  if (/^\d{10}$/.test(sin15)) return `549${sin15}`;
  return telefono.trim();
}

export interface PrimerosPasos {
  productos: boolean;
  venta: boolean;
  compra: boolean;
  equipo: boolean;
  datosFiscales: boolean;
}

/** Cuántos pasos de arranque faltan y si conviene seguir mostrando la guía. */
export function resumenPrimerosPasos(p: PrimerosPasos, diasDesdeAlta: number): { hechos: number; total: number; mostrar: boolean } {
  const valores = Object.values(p);
  const hechos = valores.filter(Boolean).length;
  // Se muestra el primer mes o hasta completar todo.
  return { hechos, total: valores.length, mostrar: hechos < valores.length && diasDesdeAlta <= 30 };
}
