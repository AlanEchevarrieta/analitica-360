import { sumarDiasIso } from '../analytics/analytics.util.js';

export const TIPOS_OBJETIVO = ['facturacion', 'ganancia', 'produccion', 'despachos', 'dias_despacho', 'a_tiempo', 'clientes_nuevos', 'ticket_promedio', 'unidades', 'cobranza'] as const;
export type TipoObjetivo = (typeof TIPOS_OBJETIVO)[number];
export const PERIODOS_OBJETIVO = ['semana', 'mes', 'trimestre', 'anio'] as const;
export type PeriodoObjetivo = (typeof PERIODOS_OBJETIVO)[number];

/** Se acumulan en el período (se puede proyectar); los otros son promedios o porcentajes. */
export const ACUMULATIVOS: readonly TipoObjetivo[] = ['facturacion', 'ganancia', 'produccion', 'despachos', 'clientes_nuevos', 'unidades', 'cobranza'];
/** En plata (pesos o dólares). */
export const EN_DINERO: readonly TipoObjetivo[] = ['facturacion', 'ganancia', 'ticket_promedio', 'cobranza'];
/** Aceptan un producto en particular. */
export const CON_PRODUCTO: readonly TipoObjetivo[] = ['produccion', 'unidades'];
/** No se pueden medir por sucursal (el dato no tiene ubicación). */
export const SIN_SUCURSAL: readonly TipoObjetivo[] = ['cobranza'];
/** Para estos, menos es mejor (la meta es un máximo). */
export const MENOS_ES_MEJOR: readonly TipoObjetivo[] = ['dias_despacho'];

export interface Rango {
  desde: string;
  hasta: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const finDeMes = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();

/** Período que contiene a `dia` (AAAA-MM-DD). La semana va de lunes a domingo. */
export function rangoPeriodo(periodo: PeriodoObjetivo, dia: string): Rango {
  const [a, m] = dia.split('-').map(Number);
  if (periodo === 'semana') {
    const dow = new Date(`${dia}T12:00:00Z`).getUTCDay();
    const desde = sumarDiasIso(dia, -((dow + 6) % 7));
    return { desde, hasta: sumarDiasIso(desde, 6) };
  }
  if (periodo === 'mes') return { desde: `${a}-${pad(m)}-01`, hasta: `${a}-${pad(m)}-${pad(finDeMes(a, m))}` };
  if (periodo === 'trimestre') {
    const m1 = Math.floor((m - 1) / 3) * 3 + 1;
    return { desde: `${a}-${pad(m1)}-01`, hasta: `${a}-${pad(m1 + 2)}-${pad(finDeMes(a, m1 + 2))}` };
  }
  return { desde: `${a}-01-01`, hasta: `${a}-12-31` };
}

/** Los `n` períodos cerrados anteriores al que contiene a `dia`, del más reciente al más viejo. */
export function periodosAnteriores(periodo: PeriodoObjetivo, dia: string, n: number): Rango[] {
  const out: Rango[] = [];
  let actual = rangoPeriodo(periodo, dia);
  for (let i = 0; i < n; i++) {
    actual = rangoPeriodo(periodo, sumarDiasIso(actual.desde, -1));
    out.push(actual);
  }
  return out;
}

export const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1;

export type Semaforo = 'bien' | 'justo' | 'mal' | 'sin_datos';

export const NOMBRE_TIPO: Record<TipoObjetivo, string> = {
  facturacion: 'Facturación',
  ganancia: 'Ganancia',
  produccion: 'Producción',
  despachos: 'Pedidos despachados',
  dias_despacho: 'Días de despacho',
  a_tiempo: 'Despachos a tiempo',
  clientes_nuevos: 'Clientes nuevos',
  ticket_promedio: 'Ticket promedio',
  unidades: 'Unidades vendidas',
  cobranza: 'Cobranza de cuenta corriente',
};
export const ADJETIVO_PERIODO: Record<PeriodoObjetivo, string> = { semana: 'semanal', mes: 'mensual', trimestre: 'trimestral', anio: 'anual' };
export const TEXTO_SEMAFORO: Record<Semaforo, string> = { bien: 'en camino', justo: 'va justo', mal: 'no llega', sin_datos: 'sin datos' };

/** Cómo se lee un valor: pesos, dólares, unidades, días o porcentaje. */
export function valorObjetivo(tipo: TipoObjetivo, moneda: 'ARS' | 'USD', v: number | null): string {
  if (v == null) return '—';
  const n = (x: number, d = 0) => x.toLocaleString('es-AR', { maximumFractionDigits: d });
  if (EN_DINERO.includes(tipo)) return moneda === 'USD' ? `US$ ${n(v)}` : `$ ${n(v)}`;
  if (tipo === 'dias_despacho') return `${n(v, 1)} días`;
  if (tipo === 'a_tiempo') return `${n(v, 1)} %`;
  if (tipo === 'produccion' || tipo === 'unidades') return `${n(v)} u.`;
  return n(v);
}

export interface Avance {
  desde: string;
  hasta: string;
  /** La meta de ese período (la propia del período si tiene, si no la general). */
  meta: number;
  /** null = no hay datos para medir (ej. ningún pedido despachado). */
  valor: number | null;
  /** valor / meta, en %. Para "menos es mejor", meta / valor. */
  porcentaje: number | null;
  /** Cuánto del período ya pasó, en % (solo acumulativos). */
  esperado: number | null;
  /** A este ritmo, cómo cierra el período (solo acumulativos y período en curso). */
  proyeccion: number | null;
  semaforo: Semaforo;
}

/**
 * Avance de un objetivo en un período. `hoy` dentro del período = en curso
 * (con ritmo y proyección); `hoy` después = cerrado (se juzga el valor final).
 */
export function evaluar(tipo: TipoObjetivo, meta: number, valor: number | null, rango: Rango, hoy: string): Avance {
  const base = { desde: rango.desde, hasta: rango.hasta, meta };
  if (valor == null) return { ...base, valor: null, porcentaje: null, esperado: null, proyeccion: null, semaforo: 'sin_datos' };
  const cerrado = hoy > rango.hasta;
  const redondo = (n: number) => Math.round(n * 10) / 10;

  if (!ACUMULATIVOS.includes(tipo)) {
    const menos = MENOS_ES_MEJOR.includes(tipo);
    const porcentaje = menos ? (valor <= 0 ? 100 : (meta / valor) * 100) : (valor / meta) * 100;
    const semaforo: Semaforo = menos
      ? valor <= meta ? 'bien' : valor <= meta * 1.2 ? 'justo' : 'mal'
      : valor >= meta ? 'bien' : (tipo === 'a_tiempo' ? valor >= meta - 5 : valor >= meta * 0.9) ? 'justo' : 'mal';
    return { ...base, valor, porcentaje: redondo(porcentaje), esperado: null, proyeccion: null, semaforo };
  }

  const porcentaje = redondo((valor / meta) * 100);
  if (cerrado) return { ...base, valor, porcentaje, esperado: 100, proyeccion: null, semaforo: valor >= meta ? 'bien' : valor >= meta * 0.9 ? 'justo' : 'mal' };
  const total = diasEntre(rango.desde, rango.hasta);
  const pasados = Math.min(total, Math.max(1, diasEntre(rango.desde, hoy)));
  const proyeccion = (valor / pasados) * total;
  return {
    ...base,
    valor,
    porcentaje,
    esperado: redondo((pasados / total) * 100),
    proyeccion: Math.round(proyeccion * 100) / 100,
    semaforo: proyeccion >= meta ? 'bien' : proyeccion >= meta * 0.9 ? 'justo' : 'mal',
  };
}

/** ¿Hay que avisar? Acumulativo, período en curso, ya pasó al menos un cuarto y a este ritmo no llega. */
export function correspondeAviso(tipo: TipoObjetivo, a: Avance, hoy: string): boolean {
  return ACUMULATIVOS.includes(tipo) && hoy <= a.hasta && (a.esperado ?? 0) >= 25 && a.semaforo === 'mal';
}
