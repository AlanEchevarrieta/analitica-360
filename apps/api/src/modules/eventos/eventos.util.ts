/**
 * Utilidades puras de la cola de eventos (Etapa 1):
 * - tiempos de espera entre reintentos con ±10 % al azar,
 * - clasificación de errores (temporales vs definitivos),
 * - recorte seguro de mensajes de error.
 */

export type TipoEvento =
  | 'correo.enviar'
  | 'informe.enviar'
  | 'vencimiento.aviso'
  | 'objetivo.aviso'
  | 'precio.aviso';

export type EstadoEvento = 'pendiente' | 'procesando' | 'hecho' | 'fallo' | 'descartado';

/** Tiempos base de espera entre reintentos (en ms): 1 min, 5 min, 30 min, 2 h, 12 h y 24 h. */
export const ESPERAS_BASE_MS = [
  1 * 60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 3_600_000,
  12 * 3_600_000,
  24 * 3_600_000,
] as const;

/** Días máximos que un evento sin servicio (ej. falta RESEND_API_KEY) espera antes de descartarse. */
export const DIAS_MAX_SIN_SERVICIO = 35;

/**
 * Devuelve cuántos milisegundos esperar antes del próximo intento (1..N),
 * aplicando una variación de ±10 % para que no salgan todos juntos.
 * `azar` recibe un número entre 0 y 1 (por defecto `Math.random()`).
 */
export function espera(intento: number, azar: number = Math.random()): number {
  const idx = Math.max(0, Math.min(ESPERAS_BASE_MS.length - 1, intento - 1));
  const base = ESPERAS_BASE_MS[idx];
  const factor = 0.9 + Math.max(0, Math.min(1, azar)) * 0.2;
  return Math.round(base * factor);
}

/**
 * Clasifica una respuesta HTTP o excepción como temporal (`true`, se reintenta)
 * o definitiva (`false`, pasa a `fallo` sin gastar reintentos).
 */
export function esErrorTemporal(info: {
  sinClave?: boolean;
  status?: number | null;
  codigo?: string | null;
  mensaje?: string | null;
}): boolean {
  if (info.sinClave) return true;
  if (info.status != null) {
    if (info.status === 429 || info.status === 408 || info.status >= 500) return true;
    // 4xx de validación o destinatario inválido (400, 401, 403, 404, 422):
    // Excepción: si el mensaje de Resend indica límite diario/mensual de cuota, es temporal.
    const msg = (info.mensaje ?? '').toLowerCase();
    if (msg.includes('quota') || msg.includes('rate_limit') || msg.includes('daily') || msg.includes('monthly')) {
      return true;
    }
    if (info.status >= 400 && info.status < 500) return false;
  }
  const msg = (info.mensaje ?? '').toLowerCase();
  if (
    msg.includes(' dato inválido') ||
    msg.includes('email inválido') ||
    msg.includes('email no es válido') ||
    msg.includes('empresa no encontrada') ||
    msg.includes('empresa borrada')
  ) {
    return false;
  }
  // Errores de red, timeout, DNS, conexión rechazada → temporales.
  return true;
}

/** Recorta un mensaje de error o detalle para que entre en la columna de la base. */
export function recortarTexto(texto: string | null | undefined, max = 1000): string | null {
  if (!texto) return null;
  const limpio = String(texto).trim();
  if (!limpio) return null;
  return limpio.length <= max ? limpio : `${limpio.slice(0, max - 1)}…`;
}

/** ¿Pasaron más de 35 días desde que se creó el evento? */
export function vencioEsperaSinServicio(creadoEn: Date, ahora: Date = new Date()): boolean {
  return ahora.getTime() - creadoEn.getTime() > DIAS_MAX_SIN_SERVICIO * 86_400_000;
}
