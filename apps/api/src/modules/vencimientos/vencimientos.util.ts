import { sumarDiasIso } from '../analytics/analytics.util.js';

/**
 * Datos que el sistema necesita al día y que, si se atrasan, nadie lo nota:
 * el dólar (lo trae solo, pero la fuente puede dejar de responder) y los
 * topes del monotributo (se cargan a mano en febrero y agosto).
 */
export type EstadoVencimiento = 'ok' | 'aviso' | 'vencido';

export interface Vencimiento {
  clave: 'dolar' | 'topes_monotributo';
  titulo: string;
  estado: EstadoVencimiento;
  /** Fecha del último dato (AAAA-MM-DD) o null si no hay ninguno. */
  ultimo: string | null;
  detalle: string;
  /** Qué hacer para ponerlo al día (vacío si está bien). */
  queHacer: string;
}

const fechaLarga = (iso: string) => iso.split('-').reverse().join('/');

/** Días de lunes a viernes estrictamente entre dos fechas (sin contar ninguna de las dos). */
export function diasHabilesEntre(desde: string, hasta: string): number {
  let n = 0;
  for (let d = sumarDiasIso(desde, 1); d < hasta; d = sumarDiasIso(d, 1)) {
    const dia = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (dia !== 0 && dia !== 6) n++;
  }
  return n;
}

/** ARCA actualiza los topes el 1° de febrero y el 1° de agosto: el último cambio que ya empezó. */
export function ultimoCorteMonotributo(hoy: string): string {
  const [a, m] = hoy.split('-').map(Number);
  if (m >= 8) return `${a}-08-01`;
  if (m >= 2) return `${a}-02-01`;
  return `${a - 1}-08-01`;
}

/**
 * Dólar: la fuente publica un valor por día hábil. Si falta un día hábil puede ser
 * un feriado (aviso); si faltan dos o más, la sincronización está fallando.
 */
export function vencimientoDolar(ultima: string | null, hoy: string): Vencimiento {
  const base = { clave: 'dolar' as const, titulo: 'Cotización del dólar', ultimo: ultima };
  if (!ultima) return { ...base, estado: 'vencido', detalle: 'No hay ninguna cotización guardada.', queHacer: 'Revisar que la API pueda conectarse a api.argentinadatos.com (se sincroniza sola cada 3 horas).' };
  const faltan = diasHabilesEntre(ultima, hoy);
  if (faltan === 0) return { ...base, estado: 'ok', detalle: `Al día: última del ${fechaLarga(ultima)}. Se actualiza sola cada 3 horas.`, queHacer: '' };
  return {
    ...base,
    estado: faltan >= 2 ? 'vencido' : 'aviso',
    detalle: `La última es del ${fechaLarga(ultima)}: faltan ${faltan} día${faltan === 1 ? '' : 's'} hábil${faltan === 1 ? '' : 'es'}${faltan === 1 ? ' (puede ser un feriado)' : ''}. Mientras tanto se usa la última que hay.`,
    queHacer: 'Revisar los registros de la API ("No se pudo actualizar el dólar"): la fuente puede estar caída o haber cambiado.',
  };
}

/** Topes del monotributo: 30 días de margen desde el corte (ARCA suele publicarlos unos días después). */
export function vencimientoTopes(vigencia: string | null, hoy: string): Vencimiento {
  const base = { clave: 'topes_monotributo' as const, titulo: 'Topes del monotributo', ultimo: vigencia };
  const corte = ultimoCorteMonotributo(hoy);
  const queHacer = 'Cargar los topes nuevos de ARCA en Consola → Sistema → Topes del monotributo (rigen desde el 1° de febrero o el 1° de agosto).';
  if (!vigencia) return { ...base, estado: 'vencido', detalle: 'No hay topes cargados.', queHacer };
  if (vigencia >= corte) return { ...base, estado: 'ok', detalle: `Al día: rigen desde el ${fechaLarga(vigencia)}. Próximo cambio: ${fechaLarga(corte.endsWith('-02-01') ? corte.replace('-02-', '-08-') : `${Number(corte.slice(0, 4)) + 1}-02-01`)}.`, queHacer: '' };
  const dias = Math.round((Date.parse(hoy) - Date.parse(corte)) / 86_400_000);
  return {
    ...base,
    estado: dias <= 30 ? 'aviso' : 'vencido',
    detalle: `Los cargados rigen desde el ${fechaLarga(vigencia)}, pero ARCA los cambió el ${fechaLarga(corte)} (hace ${dias} días). Los clientes ven el cálculo con topes viejos.`,
    queHacer,
  };
}
