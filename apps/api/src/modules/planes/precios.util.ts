/**
 * Precios de lista con fecha de vigencia (aumentos por IPC, decidido el 2026-10-09).
 *
 * Regla de los términos: un aumento se avisa por email con 30 días de anticipación
 * y rige desde el próximo período que empiece a partir de esa fecha (el anual
 * ya pago queda congelado hasta su renovación). Si el aviso sale tarde, el precio
 * se corre solo: nunca rige antes de 30 días desde que se avisó.
 */
import { PLANES_PAGOS, PRECIO_MENSUAL, type PlanPagoId } from './planes.util.js';

export const DIAS_AVISO_AUMENTO = 30;

export interface FilaPrecio {
  plan: string;
  precioMensual: number;
  /** AAAA-MM-DD */
  vigenteDesde: string;
  /** AAAA-MM-DD en que salió el aviso; null = todavía no se avisó. */
  avisadoEl: string | null;
}

export function sumarDiasFecha(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Desde cuándo rige de verdad: la fecha pedida, o 30 días después del aviso si salió tarde. Sin aviso, nunca. */
export function rigeDesde(f: Pick<FilaPrecio, 'vigenteDesde' | 'avisadoEl'>): string | null {
  if (!f.avisadoEl) return null;
  const minimo = sumarDiasFecha(f.avisadoEl, DIAS_AVISO_AUMENTO);
  return f.vigenteDesde > minimo ? f.vigenteDesde : minimo;
}

/** Precio por mes de un plan en esa fecha: el último que ya rige; si no hay ninguno, el del código. */
export function precioEnFecha(filas: readonly FilaPrecio[], plan: PlanPagoId, fecha: string): number {
  let mejor: { desde: string; precio: number } | null = null;
  for (const f of filas) {
    if (f.plan !== plan) continue;
    const desde = rigeDesde(f);
    if (!desde || desde > fecha) continue;
    if (!mejor || desde >= mejor.desde) mejor = { desde, precio: f.precioMensual };
  }
  return mejor?.precio ?? PRECIO_MENSUAL[plan];
}

export function preciosEnFecha(filas: readonly FilaPrecio[], fecha: string): Record<PlanPagoId, number> {
  return Object.fromEntries(PLANES_PAGOS.map((p) => [p, precioEnFecha(filas, p, fecha)])) as Record<PlanPagoId, number>;
}

/** Aumento por porcentaje, redondeado a los $100 (los precios quedan prolijos: $52.500, no $52.479). */
export function aplicarPorcentaje(precio: number, porcentaje: number): number {
  return Math.round((precio * (1 + porcentaje / 100)) / 100) * 100;
}

/** La primera fecha que se puede elegir para un aumento que se programa hoy. */
export function primeraFechaPosible(hoy: string): string {
  return sumarDiasFecha(hoy, DIAS_AVISO_AUMENTO);
}

/** Inflación acumulada de varios meses (ej. [2.1, 2.4, 2.6] → 7.3). */
export function inflacionAcumulada(mensuales: readonly number[]): number {
  const factor = mensuales.reduce((acc, m) => acc * (1 + m / 100), 1);
  return Math.round((factor - 1) * 1000) / 10;
}

const pesos = (n: number) => `$${n.toLocaleString('es-AR')}`;
const fechaLarga = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export interface CambioPrecio {
  plan: PlanPagoId;
  nombre: string;
  antes: number;
  despues: number;
}

/** Email al cliente: qué cambia, desde cuándo y qué puede hacer (pagar el anual ahora congela el precio). */
export function emailAumento(d: { empresa: string; vigenteDesde: string; cambios: CambioPrecio[]; motivo: string | null; planActual: PlanPagoId | null; urlPlanes: string }) {
  const propio = d.cambios.find((c) => c.plan === d.planActual);
  const asunto = `Analítica 360: nuevos precios desde el ${fechaLarga(d.vigenteDesde)}`;
  const lineas = [
    `Hola, ${d.empresa}:`,
    '',
    `Te avisamos con ${DIAS_AVISO_AUMENTO} días de anticipación que desde el ${fechaLarga(d.vigenteDesde)} actualizamos los precios de lista${d.motivo ? ` (${d.motivo})` : ''}.`,
    '',
    ...(propio ? [`Tu plan ${propio.nombre} pasa de ${pesos(propio.antes)} a ${pesos(propio.despues)} por mes.`, ''] : []),
    'Precios de lista por mes, sin IVA:',
    ...d.cambios.map((c) => `• ${c.nombre}: ${pesos(c.antes)} → ${pesos(c.despues)}`),
    '',
    'Los descuentos de siempre se mantienen: trimestral −15 % y anual −25 %, y los beneficios de tu código si tenés uno.',
    'El precio nuevo rige desde tu próximo pago a partir de esa fecha. Si ya pagaste el año, no cambia nada hasta que se renueve.',
    `Si querés mantener el precio actual por 12 meses, podés pasarte al plan anual antes del ${fechaLarga(d.vigenteDesde)}: ${d.urlPlanes}`,
    '',
    'Cualquier duda, respondé este email.',
    'Equipo de Analítica 360',
  ];
  const texto = lineas.join('\n');
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = lineas.map((l) => (l === '' ? '<br>' : `<div>${esc(l).replace(esc(d.urlPlanes), `<a href="${d.urlPlanes}">${esc(d.urlPlanes)}</a>`)}</div>`)).join('\n');
  return { asunto, texto, html };
}
