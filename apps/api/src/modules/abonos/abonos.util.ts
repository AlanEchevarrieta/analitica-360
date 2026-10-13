/**
 * Abonos (módulo de servicios, pieza 4): fechas de cada período, estado y mensajes.
 * Fechas como texto AAAA-MM-DD (días de Argentina). Todo puro: se prueba sin base.
 */

export const TIPOS_ABONO = ['mensual', 'paquete'] as const;
export type TipoAbono = (typeof TIPOS_ABONO)[number];

export type EstadoAbono = 'sin_cobrar' | 'al_dia' | 'por_vencer' | 'vencido' | 'sin_sesiones' | 'baja';

/** Faltando estos días (o menos) ya está "por vencer". */
export const DIAS_AVISO = 5;
/** Paquete sin vigencia cargada: 60 días. */
export const VIGENCIA_POR_DEFECTO = 60;
/** Si renueva hasta tantos días después de vencido, el período sigue desde donde terminó (no se "regalan" días). */
export const TOLERANCIA_RENOVACION = 10;

export function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

export const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000);

/** Suma meses de calendario (31/01 + 1 mes = 28 o 29/02). */
export function sumarMeses(fecha: string, meses: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + meses, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/** Último día de un período que empieza `desde`: mensual = un mes (del 15/10 al 14/11); paquete = su vigencia. */
export function finPeriodo(tipo: TipoAbono, desde: string, vigenciaDias: number | null): string {
  return tipo === 'mensual' ? sumarDias(sumarMeses(desde, 1), -1) : sumarDias(desde, (vigenciaDias ?? VIGENCIA_POR_DEFECTO) - 1);
}

/** Desde cuándo corre el próximo período: pegado al anterior si se renueva a tiempo (o por adelantado); si no, desde hoy. */
export function proximoDesde(hoy: string, ultimoHasta: string | null): string {
  if (!ultimoHasta) return hoy;
  const siguiente = sumarDias(ultimoHasta, 1);
  return diasEntre(siguiente, hoy) <= TOLERANCIA_RENOVACION ? siguiente : hoy;
}

export interface PeriodoEstado {
  desde: string;
  hasta: string;
  sesiones: number | null;
  usadas: number;
}

/** El período que corre hoy (el más reciente que lo incluye), si hay. */
export function periodoVigente<T extends PeriodoEstado>(hoy: string, periodos: T[]): T | null {
  return [...periodos].filter((p) => p.desde <= hoy && hoy <= p.hasta).sort((a, b) => b.desde.localeCompare(a.desde))[0] ?? null;
}

/** Estado del abono para la lista: lo primero que hay que mirar. */
export function estadoAbono(hoy: string, baja: boolean, periodos: PeriodoEstado[]): EstadoAbono {
  if (baja) return 'baja';
  if (!periodos.length) return 'sin_cobrar';
  const ultimoHasta = periodos.map((p) => p.hasta).sort().at(-1)!;
  if (ultimoHasta < hoy) return 'vencido';
  const vigente = periodoVigente(hoy, periodos);
  // Pagó por adelantado pero el período todavía no empezó: sigue al día.
  if (!vigente) return 'al_dia';
  // Ya renovó el próximo: no está por vencer aunque falten pocos días.
  const renovado = periodos.some((p) => p.desde > vigente.hasta);
  if (vigente.sesiones != null && vigente.usadas >= vigente.sesiones && !renovado) return 'sin_sesiones';
  if (!renovado && diasEntre(hoy, vigente.hasta) <= DIAS_AVISO) return 'por_vencer';
  return 'al_dia';
}

/** "15/10" */
export const diaMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/** WhatsApp para el cliente según cómo está su abono. */
export function mensajeAbono(d: { cliente: string; plan: string; estado: EstadoAbono; hasta: string | null; deuda: number; precio: number; negocio: string }): string {
  const saludo = `Hola ${d.cliente.split(' ')[0]}!`;
  const plata = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
  const deuda = d.deuda > 0 ? ` Además quedó un saldo pendiente de ${plata(d.deuda)}.` : '';
  const texto: Record<EstadoAbono, string> = {
    vencido: `Tu ${d.plan} venció el ${d.hasta ? diaMes(d.hasta) : ''}. La renovación es de ${plata(d.precio)}.${deuda}`,
    por_vencer: `Te recordamos que tu ${d.plan} vence el ${d.hasta ? diaMes(d.hasta) : ''}. La renovación es de ${plata(d.precio)}.${deuda}`,
    sin_sesiones: `Ya usaste todas las sesiones de tu ${d.plan}. Para seguir, la renovación es de ${plata(d.precio)}.${deuda}`,
    sin_cobrar: `Tu ${d.plan} está listo para arrancar: son ${plata(d.precio)}.`,
    al_dia: d.deuda > 0 ? `Te recordamos que en tu ${d.plan} quedó un saldo pendiente de ${plata(d.deuda)}.` : `Tu ${d.plan} está al día${d.hasta ? ` hasta el ${diaMes(d.hasta)}` : ''}. ¡Gracias!`,
    baja: `Tu ${d.plan} quedó dado de baja. Cuando quieras volver, avisanos.`,
  };
  return `${saludo} ${texto[d.estado]}\n${d.negocio}`;
}
