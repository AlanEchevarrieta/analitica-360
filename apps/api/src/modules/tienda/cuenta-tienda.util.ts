import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Cuentas de la tienda online: código de ingreso por email y sesiones.
 * En la base nunca se guarda el código ni el token, solo su hash.
 */

export const DURACION_CODIGO_MS = 10 * 60_000;
export const DURACION_SESION_MS = 30 * 24 * 3_600_000;
export const MAX_INTENTOS = 5;
/** Entre un código y el siguiente para el mismo email. */
export const ESPERA_ENTRE_CODIGOS_MS = 60_000;
/** Códigos por email por hora (para que no se use la tienda para mandar spam). */
export const MAX_CODIGOS_POR_HORA = 5;

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

/** 6 dígitos con un generador criptográfico (Math.random es predecible). */
export const generarCodigo = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** El hash incluye un secreto del servidor, la empresa y el email: un hash robado no sirve en otra tienda ni con otro email. */
export const hashCodigo = (secreto: string, empresaId: string, email: string, codigo: string) =>
  createHash('sha256').update(`${secreto}|${empresaId}|${normalizarEmail(email)}|${codigo}`).digest('hex');

export function mismoHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Token de sesión: 32 bytes aleatorios. Se le da al navegador; la base guarda el sha256. */
export const generarToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Nombre inicial de un cliente nuevo que entra solo con el email: "ana.perez@x.com" → "Ana Perez". */
export function nombreDesdeEmail(email: string): string {
  const local = normalizarEmail(email).split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim();
  return local ? local.replace(/\b\p{L}/gu, (l) => l.toUpperCase()).slice(0, 120) : 'Cliente de la tienda';
}
