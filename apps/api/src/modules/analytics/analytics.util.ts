/**
 * Formateador de fecha AR creado una sola vez: toLocaleDateString arma uno
 * nuevo en cada llamada y con 21.000 ventas tardaba 1,6 s (este, 0,03 s).
 * 'en-CA' da el formato YYYY-MM-DD.
 */
const FECHA_AR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Puerto de src/lib/analytics.ts::fechaHoyAR. */
export function fechaHoyAR(): string {
  return FECHA_AR.format(new Date());
}

/** Puerto de src/lib/analytics.ts::sumarDiasIso. */
export function sumarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

/** Puerto de src/lib/analytics.ts::lunesIso (lunes de la semana de `iso`). */
export function lunesIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return dt.toISOString().slice(0, 10);
}

/** Puerto de src/lib/analytics.ts::inicioMesIso. */
export function inicioMesIso(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Puerto de src/lib/analytics.ts::inicioAnioIso. */
export function inicioAnioIso(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}

const DIAS_ABREV = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Puerto de la etiqueta de día usada en dashboard_inicio() (SQL): extract(dow) 0=dom..6=sáb. */
export function etiquetaDiaEs(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return DIAS_ABREV[dow];
}

/** Fecha (YYYY-MM-DD) de un Date en huso AR - mismo criterio que diaAR() (fecha-sql.ts) en el SQL. */
export function fechaLocalAR(fecha: Date): string {
  return FECHA_AR.format(fecha);
}
