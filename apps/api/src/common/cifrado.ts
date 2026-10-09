import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Secretos de terceros guardados en la base (ej. credenciales de Zipnova de cada empresa):
// AES-256-GCM con CLAVE_CIFRADO (32 bytes en base64). Formato: v1.<iv>.<tag>.<datos>, en base64url.

function clave(claveBase64: string): Buffer {
  const k = Buffer.from(claveBase64, 'base64');
  if (k.length !== 32) throw new Error('CLAVE_CIFRADO tiene que ser de 32 bytes en base64 (openssl rand -base64 32)');
  return k;
}

export function cifrar(texto: string, claveBase64: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave(claveBase64), iv);
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return ['v1', iv, c.getAuthTag(), datos].map((x) => (typeof x === 'string' ? x : x.toString('base64url'))).join('.');
}

export function descifrar(cifrado: string, claveBase64: string): string {
  const [version, iv, tag, datos] = cifrado.split('.');
  if (version !== 'v1' || !iv || !tag || datos === undefined) throw new Error('Dato cifrado inválido');
  const d = createDecipheriv('aes-256-gcm', clave(claveBase64), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(datos, 'base64url')), d.final()]).toString('utf8');
}
