import { createHmac, timingSafeEqual } from 'node:crypto';
import { lunesIso, sumarDiasIso } from '../analytics/analytics.util.js';

export type TipoInforme = 'semanal' | 'mensual';
export const TIPOS_INFORME: TipoInforme[] = ['semanal', 'mensual'];

export interface Periodo {
  desde: string;
  hasta: string;
}

/** Hora a partir de la cual sale el informe (hora de Argentina). */
export const HORA_ENVIO = 8;
/** Si el servidor estuvo apagado, se manda igual hasta estos días después del cierre (más tarde ya no sirve). */
const DIAS_DE_GRACIA: Record<TipoInforme, number> = { semanal: 2, mensual: 5 };

const AR = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Día (AAAA-MM-DD) y hora de Argentina de un instante. */
export function ahoraAR(ahora: Date): { dia: string; hora: number } {
  const p = Object.fromEntries(AR.formatToParts(ahora).map((x) => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) % 24 };
}

const primeroDelMes = (iso: string) => `${iso.slice(0, 7)}-01`;
function sumarMeses(iso: string, meses: number): string {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + meses, 1));
  return d.toISOString().slice(0, 10);
}

/** El último período cerrado antes de `dia`: la semana (lunes a domingo) o el mes anterior. */
export function periodoCerrado(tipo: TipoInforme, dia: string): Periodo {
  if (tipo === 'semanal') {
    const desde = sumarDiasIso(lunesIso(dia), -7);
    return { desde, hasta: sumarDiasIso(desde, 6) };
  }
  const desde = sumarMeses(primeroDelMes(dia), -1);
  return { desde, hasta: sumarDiasIso(primeroDelMes(dia), -1) };
}

/** El período anterior a `p`, para comparar (la semana o el mes de antes). */
export function periodoPrevio(tipo: TipoInforme, p: Periodo): Periodo {
  if (tipo === 'semanal') return { desde: sumarDiasIso(p.desde, -7), hasta: sumarDiasIso(p.desde, -1) };
  return { desde: sumarMeses(p.desde, -1), hasta: sumarDiasIso(p.desde, -1) };
}

/**
 * Qué informe toca mandar ahora: el lunes desde las 8 sale la semana anterior y
 * el día 1 desde las 8 el mes anterior. Si el servidor estuvo apagado, se
 * ponen al día dentro de unos días de gracia.
 */
export function informePendiente(tipo: TipoInforme, ahora: Date): Periodo | null {
  const { dia, hora } = ahoraAR(ahora);
  const p = periodoCerrado(tipo, dia);
  const sale = sumarDiasIso(p.hasta, 1);
  if (dia === sale && hora < HORA_ENVIO) return null;
  if (dia > sumarDiasIso(sale, DIAS_DE_GRACIA[tipo])) return null;
  return p;
}

/** Variación porcentual (null si no hay base para comparar). */
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null;
  return Math.round(((actual - anterior) / Math.abs(anterior)) * 1000) / 10;
}

/** Todos los días del período, con 0 donde no hubo ventas. */
export function completarDias(p: Periodo, filas: { fecha: string; total: number }[]): { fecha: string; total: number }[] {
  const porDia = new Map(filas.map((f) => [f.fecha, f.total]));
  const dias: { fecha: string; total: number }[] = [];
  for (let d = p.desde; d <= p.hasta; d = sumarDiasIso(d, 1)) dias.push({ fecha: d, total: porDia.get(d) ?? 0 });
  return dias;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const diaSemana = (iso: string) => DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const ddmmaaaa = (iso: string) => `${ddmm(iso)}/${iso.slice(0, 4)}`;

/** "Semana del 28/09 al 04/10/2026" o "Septiembre 2026". */
export function nombrePeriodo(tipo: TipoInforme, p: Periodo): string {
  if (tipo === 'mensual') {
    const mes = MESES[Number(p.desde.slice(5, 7)) - 1];
    return `${mes[0].toUpperCase()}${mes.slice(1)} ${p.desde.slice(0, 4)}`;
  }
  return `Semana del ${ddmm(p.desde)} al ${ddmmaaaa(p.hasta)}`;
}

const PESOS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
/** $ 1.234.567 (sin centavos: es un resumen). */
export const pesos = (n: number) => PESOS.format(Math.round(n)).replace(/ /g, ' ');
export const entero = (n: number) => new Intl.NumberFormat('es-AR').format(Math.round(n));
/** US$ 1.234 (con centavos si es menos de 100). */
export const dolares = (n: number) => `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: Math.abs(n) < 100 ? 2 : 0, maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 })}`;
export const pct = (n: number | null) => (n == null ? '' : `${n > 0 ? '+' : ''}${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`);

// --- Baja desde el link del email (sin iniciar sesión): firmada para que nadie dé de baja a otro. ---

const firma = (secreto: string, datos: string) => createHmac('sha256', `informes:${secreto}`).update(datos).digest('base64url');

export function tokenBaja(secreto: string, empresaId: string, tipo: TipoInforme, email: string): string {
  const datos = Buffer.from(JSON.stringify([empresaId, tipo, email])).toString('base64url');
  return `${datos}.${firma(secreto, datos)}`;
}

export function leerTokenBaja(secreto: string, token: string): { empresaId: string; tipo: TipoInforme; email: string } | null {
  const [datos, f] = token.split('.');
  if (!datos || !f) return null;
  const esperada = Buffer.from(firma(secreto, datos));
  const recibida = Buffer.from(f);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const [empresaId, tipo, email] = JSON.parse(Buffer.from(datos, 'base64url').toString()) as [string, TipoInforme, string];
    if (!TIPOS_INFORME.includes(tipo) || typeof empresaId !== 'string' || typeof email !== 'string') return null;
    return { empresaId, tipo, email };
  } catch {
    return null;
  }
}

/** Quién lo recibe: dueños + extras, sin repetir y sin los que se dieron de baja de ese tipo. */
export function destinatarios(duenos: string[], extras: string[], bajas: string[], tipo: TipoInforme): string[] {
  const fuera = new Set(bajas.filter((b) => b.startsWith(`${tipo}:`)).map((b) => b.slice(tipo.length + 1)));
  const todos = [...duenos, ...extras].map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'));
  return [...new Set(todos)].filter((e) => !fuera.has(e));
}
