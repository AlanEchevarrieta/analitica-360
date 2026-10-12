/**
 * Agenda (módulo de servicios, pieza 3): horas de Argentina (UTC−3, sin horario de
 * verano), superposiciones y horarios libres. Todo puro: se prueba sin base.
 */

export const ESTADOS_TURNO = ['reservado', 'confirmado', 'atendido', 'no_vino', 'cancelado'] as const;
export type EstadoTurno = (typeof ESTADOS_TURNO)[number];
/** Estos ocupan el horario; "no vino" y "cancelado" lo liberan. */
export const OCUPAN: readonly EstadoTurno[] = ['reservado', 'confirmado', 'atendido'];

export const DURACION_POR_DEFECTO = 30;
const OFFSET = '-03:00';

/** "2026-10-14T15:30" (hora de Argentina) → Date. */
export function desdeHoraAR(local: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Formato de fecha y hora inválido');
  return new Date(`${local}:00${OFFSET}`);
}

/** Date → "2026-10-14T15:30" en hora de Argentina. */
export function aHoraAR(d: Date): string {
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 16);
}

/** "09:30" → 570 */
export const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const horaValida = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

/** Día de la semana (0 = domingo) de una fecha AAAA-MM-DD. */
export const diaSemana = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

/** ¿Se pisan dos intervalos [inicio, fin)? Pegados (uno termina cuando empieza el otro) no se pisan. */
export const sePisan = (a: { inicio: Date; fin: Date }, b: { inicio: Date; fin: Date }) => a.inicio < b.fin && b.inicio < a.fin;

/** Tramos válidos: desde < hasta y sin pisarse dentro del mismo día. */
export function validarHorarios(horarios: { diaSemana: number; desde: string; hasta: string }[]): string | null {
  for (const h of horarios) {
    if (h.diaSemana < 0 || h.diaSemana > 6) return 'Día de la semana inválido';
    if (!horaValida(h.desde) || !horaValida(h.hasta)) return 'Las horas van como 09:00';
    if (minutos(h.desde) >= minutos(h.hasta)) return `El horario ${h.desde} a ${h.hasta} no tiene sentido: el "desde" tiene que ser antes`;
  }
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    const del = horarios.filter((h) => h.diaSemana === d).sort((a, b) => minutos(a.desde) - minutos(b.desde));
    for (let i = 1; i < del.length; i++) if (minutos(del[i].desde) < minutos(del[i - 1].hasta)) return 'Hay horarios que se pisan en el mismo día';
  }
  return null;
}

/** ¿El turno cae entero dentro de algún tramo de atención de ese día? */
export function dentroDelHorario(horarios: { diaSemana: number; desde: string; hasta: string }[], inicioLocal: string, duracion: number): boolean {
  const fecha = inicioLocal.slice(0, 10);
  const ini = minutos(inicioLocal.slice(11, 16));
  return horarios.some((h) => h.diaSemana === diaSemana(fecha) && ini >= minutos(h.desde) && ini + duracion <= minutos(h.hasta));
}

/**
 * Horarios libres de un día para un recurso: dentro de sus tramos, cada `paso`
 * minutos, sin pisar turnos ocupados y (si es hoy) solo desde ahora en adelante.
 */
export function horariosLibres(d: {
  fecha: string;
  horarios: { diaSemana: number; desde: string; hasta: string }[];
  ocupados: { inicio: Date; fin: Date }[];
  duracion: number;
  paso?: number;
  ahora?: Date;
  cerrado?: boolean;
}): string[] {
  if (d.cerrado) return [];
  const paso = d.paso ?? 15;
  const libres: string[] = [];
  for (const h of d.horarios.filter((x) => x.diaSemana === diaSemana(d.fecha)).sort((a, b) => minutos(a.desde) - minutos(b.desde))) {
    for (let m = minutos(h.desde); m + d.duracion <= minutos(h.hasta); m += paso) {
      const inicio = desdeHoraAR(`${d.fecha}T${hhmm(m)}`);
      const fin = new Date(inicio.getTime() + d.duracion * 60_000);
      if (d.ahora && inicio <= d.ahora) continue;
      if (d.ocupados.some((o) => sePisan({ inicio, fin }, o))) continue;
      libres.push(hhmm(m));
    }
  }
  return [...new Set(libres)];
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "el jueves 15/10 a las 15:30" */
export function cuandoTexto(inicio: Date): string {
  const local = aHoraAR(inicio);
  const fecha = local.slice(0, 10);
  return `el ${DIAS[diaSemana(fecha)]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)} a las ${local.slice(11, 16)}`;
}

/** Recordatorio por WhatsApp. */
export function mensajeRecordatorio(d: { cliente: string | null; servicio: string | null; profesional: string; inicio: Date; negocio: string }): string {
  const saludo = `Hola${d.cliente ? ` ${d.cliente.split(' ')[0]}` : ''}!`;
  return `${saludo} Te recordamos tu turno${d.servicio ? ` de ${d.servicio}` : ''} con ${d.profesional} ${cuandoTexto(d.inicio)}. Si no podés venir, avisanos así se lo damos a otra persona. ¡Gracias!\n${d.negocio}`;
}
