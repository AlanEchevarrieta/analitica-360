/** Tienda online: reglas de la dirección (subdominio / dominio propio). */

/** Subdominios que no puede usar una tienda (son de la plataforma). */
export const RESERVADOS = new Set([
  'www', 'app', 'api', 'admin', 'tienda', 'tiendas', 'mail', 'email', 'soporte', 'ayuda', 'blog', 'static', 'cdn', 'archivos',
  'dashboard', 'panel', 'login', 'registro', 'cuenta', 'pagos', 'status', 'dev', 'staging', 'test', 'demo', 'analitica', 'analitica360',
]);

/** Sugerencia de subdominio a partir del nombre del negocio ("Acacia Mates" -> "acacia-mates"). */
export function sugerirSubdominio(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

/** null si es válido; si no, el motivo. */
export function problemaSubdominio(sub: string): string | null {
  if (sub.length < 3) return 'Tiene que tener al menos 3 letras';
  if (sub.length > 40) return 'Máximo 40 caracteres';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(sub)) return 'Solo letras minúsculas, números y guiones (sin tildes ni espacios)';
  if (RESERVADOS.has(sub)) return 'Esa dirección está reservada, elegí otra';
  return null;
}

/** "https://www.AcaciaMates.com.ar/tienda" -> "acaciamates.com.ar" (null si no parece un dominio). */
export function normalizarDominio(entrada: string): string | null {
  const d = entrada
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^www\./, '');
  return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(d) ? d : null;
}

export type Sitio = { tipo: 'subdominio'; valor: string } | { tipo: 'dominio'; valor: string };

/**
 * Qué tienda corresponde a un host. `base` = dominio de la plataforma
 * (ej. analitica360.app); en desarrollo sirve `acacia.localhost`.
 */
export function sitioDesdeHost(hostCrudo: string, base: string): Sitio | null {
  const host = hostCrudo.trim().toLowerCase().replace(/:\d+$/, '');
  if (!host) return null;
  for (const raiz of [base.toLowerCase(), 'localhost']) {
    if (host.endsWith(`.${raiz}`)) {
      const sub = host.slice(0, -raiz.length - 1);
      return sub && !sub.includes('.') && !RESERVADOS.has(sub) ? { tipo: 'subdominio', valor: sub } : null;
    }
    if (host === raiz) return null;
  }
  const dominio = normalizarDominio(host);
  return dominio ? { tipo: 'dominio', valor: dominio } : null;
}

/** Tipos de imagen aceptados, verificando la firma real del archivo (no solo lo que dice el navegador). */
export function tipoImagen(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}
