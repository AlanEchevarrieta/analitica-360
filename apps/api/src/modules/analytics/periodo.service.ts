import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYTICS_PERIODO_REPOSITORY,
  type AnalyticsFormaPago,
  type AnalyticsPeriodoProducto,
  type AnalyticsPeriodoRepository,
  type AnalyticsTopProducto,
  type GranularidadPeriodo,
} from './periodo.repository.js';
import { fechaLocalAR, sumarDiasIso } from './analytics.util.js';
import { CotizacionesService, type Moneda } from '../cotizaciones/cotizaciones.service.js';

/** Mismo tope que LIMITE_ANALYTICS_VENTAS en src/lib/analytics.ts - por encima de esto no se carga el detalle. */
export const LIMITE_ANALYTICS_VENTAS = 50_000;

export interface AnalyticsPeriodoResultado {
  total: number;
  cantidad: number;
  costo: number;
  porCobrar: number;
  evolucion: { fecha: string; total: number; anterior: number; cantidad: number }[];
  evolucionDiaria: { fecha: string; total: number }[];
  /** Ventas por día de la semana (0 = domingo … 6 = sábado), día local AR. */
  diasSemana: { dia: number; total: number; cantidad: number }[];
  /** Ventas por hora del día (0 a 23, hora AR). */
  horas: { hora: number; total: number; cantidad: number }[];
  /** Ventas cargadas sin hora en el sistema anterior (quedaron a las 12:00:00 en punto). */
  ventasSinHora: number;
  /** Compras del período por día, para comparar contra las ventas. */
  comprasDiarias: { fecha: string; total: number }[];
  formasPago: AnalyticsFormaPago[];
  top10: { nombre: string; unidades: number }[];
  productos: AnalyticsPeriodoProducto[];
  /** Neto de devoluciones/cambios del período, ya incluido en total y costo. */
  devoluciones: { ingreso: number; costo: number };
}

export interface AnalyticsPeriodoRespuesta {
  avisoLimite: number | null;
  data: AnalyticsPeriodoResultado | null;
}

/** Agrupa por día local AR (el legacy usaba el día UTC y corría al día siguiente las ventas después de las 21 h). */
function evolucionDiariaDesdeVentas(ventas: { fecha: Date; total: number }[]): { fecha: string; total: number }[] {
  const porDia = new Map<string, number>();
  for (const v of ventas) {
    const iso = fechaLocalAR(v.fecha);
    porDia.set(iso, (porDia.get(iso) ?? 0) + v.total);
  }
  return [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, total]) => ({ fecha, total }));
}

const HORA_EXACTA_AR = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const HORA_AR = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Argentina/Buenos_Aires', hour: 'numeric', hourCycle: 'h23' });

/** Total y cantidad de ventas por hora del día (hora local AR). */
export function ventasPorHora(ventas: { fecha: Date; total: number }[]): { hora: number; total: number; cantidad: number }[] {
  const horas = Array.from({ length: 24 }, (_, hora) => ({ hora, total: 0, cantidad: 0 }));
  for (const v of ventas) {
    const h = horas[Number(HORA_AR.format(v.fecha)) % 24];
    h.total += v.total;
    h.cantidad += 1;
  }
  return horas;
}

/** Total y cantidad de ventas por día de la semana (día local AR). */
export function ventasPorDiaSemana(ventas: { fecha: Date; total: number }[]): { dia: number; total: number; cantidad: number }[] {
  const dias = Array.from({ length: 7 }, (_, dia) => ({ dia, total: 0, cantidad: 0 }));
  for (const v of ventas) {
    const [y, m, d] = fechaLocalAR(v.fecha).split('-').map(Number);
    const dia = dias[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    dia.total += v.total;
    dia.cantidad += 1;
  }
  return dias;
}

@Injectable()
export class AnalyticsPeriodoService {
  constructor(
    @Inject(ANALYTICS_PERIODO_REPOSITORY) private readonly repository: AnalyticsPeriodoRepository,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  async periodo(empresaId: string, desde: string, hasta: string, granularidad: GranularidadPeriodo, moneda?: Moneda): Promise<AnalyticsPeriodoRespuesta> {
    const conteo = await this.repository.contarVentas(empresaId, desde, hasta);
    if (conteo > LIMITE_ANALYTICS_VENTAS) {
      return { avisoLimite: conteo, data: null };
    }

    // La evolución compara con el período anterior de igual duración: el rango arranca ahí.
    const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1;
    const conv = await this.cotizaciones.conversor(empresaId, moneda, sumarDiasIso(desde, -dias), hasta);
    const [base, evolucion, formasPago, topProductos, comprasDiarias] = await Promise.all([
      this.repository.periodoBase(empresaId, desde, hasta, conv),
      this.repository.evolucion(empresaId, desde, hasta, granularidad, conv),
      this.repository.formasPago(empresaId, desde, hasta, conv),
      this.repository.topProductos(empresaId, desde, hasta, conv),
      this.repository.comprasPorDia(empresaId, desde, hasta, conv),
    ]);

    return {
      avisoLimite: null,
      data: {
        total: base.totalVentas,
        cantidad: base.cantidad,
        costo: base.costo,
        porCobrar: base.porCobrar,
        evolucion,
        evolucionDiaria: evolucionDiariaDesdeVentas(base.ventas),
        diasSemana: ventasPorDiaSemana(base.ventas),
        horas: ventasPorHora(base.ventas),
        ventasSinHora: base.ventas.filter((v) => HORA_EXACTA_AR.format(v.fecha) === '12:00:00' && v.fecha.getUTCMilliseconds() === 0).length,
        comprasDiarias,
        formasPago,
        // analytics_top_productos siempre gana sobre el top_10 propio de analytics_periodo, igual que cargarAnalyticsPeriodo().
        top10: topProductos.map((p: AnalyticsTopProducto) => ({ nombre: p.nombre, unidades: p.unidades })),
        productos: base.productos,
        devoluciones: base.devoluciones,
      },
    };
  }
}
