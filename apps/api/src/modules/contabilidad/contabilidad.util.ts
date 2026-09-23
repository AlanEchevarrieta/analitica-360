import { fechaHoyAR, inicioMesIso } from '../analytics/analytics.util.js';

/**
 * Puerto fiel de src/lib/contabilidad.ts. `labelMesClave` (formato es-AR del
 * mes) y `rangoMesCompleto` (helper de navegación mes a mes de la UI) quedan
 * afuera - presentación/navegación de UI, no lógica de negocio, mismo
 * criterio que en analytics_periodo/insights/inflación. Se devuelve `clave`
 * (YYYY-MM) cruda.
 */

export type PresetContabilidad = 'mes' | 'mes_ant' | 'trimestre' | 'anio' | 'personalizado';

export interface TotalesPeriodo {
  ingresos: number;
  cogs: number;
  gastos: number;
  neto: number;
  cantidadVentas: number;
}

export interface PuntoMes {
  clave: string;
  ingresos: number;
  cogs: number;
  gastos: number;
  resultado: number;
}

export interface VentaConCogs {
  id: string;
  fecha: string;
  total: number;
}

export interface ItemCogs {
  ventaId: string;
  cogs: number;
}

export interface GastoParaContabilidad {
  fecha: string;
  monto: number;
  recurrente: boolean;
}

function ultimoDiaMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Puerto de rangoContabilidad. */
export function rangoContabilidad(preset: PresetContabilidad, desde?: string, hasta?: string): { desde: string; hasta: string } {
  const hoy = fechaHoyAR();
  if (preset === 'personalizado') {
    return { desde: desde || inicioMesIso(hoy), hasta: hasta || hoy };
  }
  const [y, m] = hoy.split('-').map(Number);
  if (preset === 'mes') return { desde: inicioMesIso(hoy), hasta: hoy };
  if (preset === 'mes_ant') {
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    const d = `${String(py).padStart(4, '0')}-${String(pm).padStart(2, '0')}`;
    return { desde: `${d}-01`, hasta: `${d}-${String(ultimoDiaMes(py, pm)).padStart(2, '0')}` };
  }
  if (preset === 'trimestre') {
    const q = Math.floor((m - 1) / 3);
    const startM = q * 3 + 1;
    return { desde: `${y}-${String(startM).padStart(2, '0')}-01`, hasta: hoy };
  }
  return { desde: `${y}-01-01`, hasta: hoy };
}

/** Puerto de mesesAtras: claves YYYY-MM de los últimos `cantidad` meses, terminando en el mes de `hoy`. */
export function mesesAtras(hoy: string, cantidad: number): string[] {
  const [y, m] = hoy.split('-').map(Number);
  const out: string[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** Puerto de sumarPeriodo: totales (ingresos/COGS/gastos/neto) de ventas+gastos ya cargados, filtrados a [desde,hasta]. */
export function sumarPeriodo(ventas: VentaConCogs[], items: ItemCogs[], gastos: GastoParaContabilidad[], desde: string, hasta: string): TotalesPeriodo {
  const enRango = (iso: string) => iso >= desde && iso <= hasta;
  const ventasP = ventas.filter((v) => enRango(v.fecha));
  const ids = new Set(ventasP.map((v) => v.id));
  const ingresos = ventasP.reduce((a, v) => a + v.total, 0);
  const cogs = items.filter((i) => ids.has(i.ventaId)).reduce((a, i) => a + i.cogs, 0);
  const g = gastos.filter((x) => enRango(x.fecha)).reduce((a, x) => a + x.monto, 0);
  return { ingresos, cogs, gastos: g, neto: ingresos - cogs - g, cantidadVentas: ventasP.length };
}

/** Puerto de serieMensual: un punto por cada clave YYYY-MM en `claves`. */
export function serieMensual(claves: string[], ventas: VentaConCogs[], items: ItemCogs[], gastos: GastoParaContabilidad[]): PuntoMes[] {
  const cogsPorVenta = new Map<string, number>();
  for (const it of items) cogsPorVenta.set(it.ventaId, (cogsPorVenta.get(it.ventaId) ?? 0) + it.cogs);
  return claves.map((clave) => {
    const ventasM = ventas.filter((v) => v.fecha.startsWith(clave));
    const ingresos = ventasM.reduce((a, v) => a + v.total, 0);
    const cogs = ventasM.reduce((a, v) => a + (cogsPorVenta.get(v.id) ?? 0), 0);
    const g = gastos.filter((x) => x.fecha.startsWith(clave)).reduce((a, x) => a + x.monto, 0);
    return { clave, ingresos, cogs, gastos: g, resultado: ingresos - cogs - g };
  });
}

export interface RatiosFinancieros {
  margenBrutoPct: number;
  margenNetoPct: number;
  puntoEquilibrio: number;
  roiPct: number;
  diasInventario: number;
  ticket: number;
  neto: number;
}

/** Puerto de ratiosFinancieros. */
export function ratiosFinancieros(input: {
  ingresos: number;
  cogs: number;
  gastos: number;
  cantidadVentas: number;
  valorInventario: number;
  gastosFijos: number;
}): RatiosFinancieros {
  const { ingresos, cogs, gastos, cantidadVentas, valorInventario, gastosFijos } = input;
  const margenBrutoPct = ingresos > 0 ? ((ingresos - cogs) / ingresos) * 100 : 0;
  const neto = ingresos - cogs - gastos;
  const margenNetoPct = ingresos > 0 ? (neto / ingresos) * 100 : 0;
  const mbFrac = margenBrutoPct / 100;
  const puntoEquilibrio = mbFrac > 0 ? gastosFijos / mbFrac : 0;
  const invertido = cogs + gastos;
  const roiPct = invertido > 0 ? (neto / invertido) * 100 : 0;
  const cogsDia = cogs / 30;
  const diasInventario = cogsDia > 0 ? valorInventario / cogsDia : 0;
  const ticket = cantidadVentas > 0 ? ingresos / cantidadVentas : 0;
  return { margenBrutoPct, margenNetoPct, puntoEquilibrio, roiPct, diasInventario, ticket, neto };
}

export type Semaforo = 'verde' | 'amarillo' | 'rojo';

/** Puerto de semaforoMargenBruto. */
export function semaforoMargenBruto(pct: number): Semaforo {
  if (pct > 50) return 'verde';
  if (pct >= 30) return 'amarillo';
  return 'rojo';
}

/** Puerto de semaforoMargenNeto. */
export function semaforoMargenNeto(pct: number): Semaforo {
  if (pct > 20) return 'verde';
  if (pct >= 10) return 'amarillo';
  return 'rojo';
}

/** Puerto de proyectarFlujo: proyecta `meses` a futuro usando el promedio de los últimos 3 puntos de `serie6`. */
export function proyectarFlujo(serie6: PuntoMes[], meses = 3): PuntoMes[] {
  const ult3 = serie6.slice(-3);
  const avgIng = ult3.length ? ult3.reduce((a, p) => a + p.ingresos, 0) / ult3.length : 0;
  const avgCogs = ult3.length ? ult3.reduce((a, p) => a + p.cogs, 0) / ult3.length : 0;
  const avgGas = ult3.length ? ult3.reduce((a, p) => a + p.gastos, 0) / ult3.length : 0;
  const avgRes = avgIng - avgCogs - avgGas;
  const hoy = fechaHoyAR();
  const [y, m] = hoy.split('-').map(Number);
  const extra: PuntoMes[] = [];
  for (let k = 1; k <= meses; k++) {
    const dt = new Date(Date.UTC(y, m - 1 + k, 1));
    const clave = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
    extra.push({ clave, ingresos: avgIng, cogs: avgCogs, gastos: avgGas, resultado: avgRes });
  }
  return extra;
}

export interface PuntoMesAcumulado extends PuntoMes {
  acumulado: number;
}

/** Puerto de acumuladoSerie: flujo de caja acumulado punto a punto. */
export function acumuladoSerie(puntos: PuntoMes[]): PuntoMesAcumulado[] {
  let acc = 0;
  return puntos.map((p) => {
    acc += p.resultado;
    return { ...p, acumulado: acc };
  });
}
