import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYTICS_PERIODO_REPOSITORY,
  type AnalyticsFormaPago,
  type AnalyticsPeriodoProducto,
  type AnalyticsPeriodoRepository,
  type AnalyticsTopProducto,
  type GranularidadPeriodo,
} from './periodo.repository.js';

/** Mismo tope que LIMITE_ANALYTICS_VENTAS en src/lib/analytics.ts - por encima de esto no se carga el detalle. */
export const LIMITE_ANALYTICS_VENTAS = 50_000;

export interface AnalyticsPeriodoResultado {
  total: number;
  cantidad: number;
  costo: number;
  porCobrar: number;
  evolucion: { fecha: string; total: number; anterior: number; cantidad: number }[];
  evolucionDiaria: { fecha: string; total: number }[];
  formasPago: AnalyticsFormaPago[];
  top10: { nombre: string; unidades: number }[];
  productos: AnalyticsPeriodoProducto[];
}

export interface AnalyticsPeriodoRespuesta {
  avisoLimite: number | null;
  data: AnalyticsPeriodoResultado | null;
}

/** Agrupa por día calendario UTC de `fecha`, igual que evolucionDesdeVentas() en el legacy (no usa huso AR, a diferencia de evolucion()). */
function evolucionDiariaDesdeVentas(ventas: { fecha: Date; total: number }[]): { fecha: string; total: number }[] {
  const porDia = new Map<string, number>();
  for (const v of ventas) {
    const iso = v.fecha.toISOString().slice(0, 10);
    porDia.set(iso, (porDia.get(iso) ?? 0) + v.total);
  }
  return [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, total]) => ({ fecha, total }));
}

@Injectable()
export class AnalyticsPeriodoService {
  constructor(
    @Inject(ANALYTICS_PERIODO_REPOSITORY) private readonly repository: AnalyticsPeriodoRepository,
  ) {}

  async periodo(empresaId: string, desde: string, hasta: string, granularidad: GranularidadPeriodo): Promise<AnalyticsPeriodoRespuesta> {
    const conteo = await this.repository.contarVentas(empresaId, desde, hasta);
    if (conteo > LIMITE_ANALYTICS_VENTAS) {
      return { avisoLimite: conteo, data: null };
    }

    const [base, evolucion, formasPago, topProductos] = await Promise.all([
      this.repository.periodoBase(empresaId, desde, hasta),
      this.repository.evolucion(empresaId, desde, hasta, granularidad),
      this.repository.formasPago(empresaId, desde, hasta),
      this.repository.topProductos(empresaId, desde, hasta),
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
        formasPago,
        // analytics_top_productos siempre gana sobre el top_10 propio de analytics_periodo, igual que cargarAnalyticsPeriodo().
        top10: topProductos.map((p: AnalyticsTopProducto) => ({ nombre: p.nombre, unidades: p.unidades })),
        productos: base.productos,
      },
    };
  }
}
