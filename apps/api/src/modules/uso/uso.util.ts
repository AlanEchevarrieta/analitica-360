/** Uso de la app: limpieza de lo que manda el navegador antes de guardarlo. */

/** Ruta sin ids ni query: /ventas/3f2c…/editar?x=1 → /ventas/:id/editar. */
export function normalizarRuta(ruta: string): string {
  const limpia = (ruta.split(/[?#]/)[0] || '/')
    .split('/')
    .map((s) => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) || /^\d+$/.test(s) ? ':id' : s))
    .join('/');
  return limpia.slice(0, 200) || '/';
}

/** Texto del botón: una línea, sin espacios de más y corto. */
export function normalizarObjetivo(objetivo: string | null | undefined): string | null {
  const t = (objetivo ?? '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, 80) : null;
}

/** Inicio de los últimos `dias` días contando desde ahora. */
export function desdeDias(dias: number, ahora = new Date()): Date {
  return new Date(ahora.getTime() - dias * 86_400_000);
}
