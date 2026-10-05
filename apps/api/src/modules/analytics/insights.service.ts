import { Inject, Injectable } from '@nestjs/common';
import { INSIGHTS_REPOSITORY, type InsightsRepository } from './insights.repository.js';
import {
  armarForecast,
  armarVariantes,
  calcularElasticidades,
  calcularSalud,
  inicioMesHace,
  mesAnteriorDe,
  preciosOptimos,
  serieDiariaDe,
  type FilaElasticidad,
  type InsightsErrores,
  type InsightsPayload,
  type InsightSalud,
  type InsightVariantes,
} from './insights.util.js';
import { fechaHoyAR, inicioMesIso, sumarDiasIso } from './analytics.util.js';
import { CotizacionesService, type Moneda } from '../cotizaciones/cotizaciones.service.js';

const VACIO: InsightsPayload = {
  salud: null,
  elasticidades: [],
  forecast: null,
  serieDiaria: [],
  diasHistorial: 0,
  variantes: null,
  precios: [],
  errores: {},
};

@Injectable()
export class InsightsService {
  constructor(
    @Inject(INSIGHTS_REPOSITORY) private readonly repository: InsightsRepository,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  async insights(empresaId: string, pronostico: 'semana' | 'mes' = 'semana', moneda?: Moneda): Promise<InsightsPayload> {
    const errores: InsightsErrores = {};
    const hoy = fechaHoyAR();
    const mesIni = inicioMesIso(hoy);
    const mesAntIni = mesAnteriorDe(mesIni);
    const mesAntFin = sumarDiasIso(mesIni, -1);
    const desdeFetch = inicioMesHace(hoy, 5);

    let productos: Awaited<ReturnType<InsightsRepository['productosConStock']>> = [];
    let ventas: Awaited<ReturnType<InsightsRepository['ventasRango']>> = [];
    let items: Awaited<ReturnType<InsightsRepository['itemsDeVentas']>> = [];
    let historial: Awaited<ReturnType<InsightsRepository['historialPrecios']>> = [];
    let diasHistorial = 0;
    let serieForecast: Awaited<ReturnType<InsightsRepository['serieVentasHistorial']>> = [];
    let usaVariantes = false;

    try {
      const [productosRes, ventasRes, historialRes, dias, serieHist, usaVar] = await Promise.all([
        this.repository.productosConStock(empresaId),
        this.repository.ventasRango(empresaId, desdeFetch, hoy),
        this.repository.historialPrecios(empresaId),
        this.repository.diasDesdePrimeraVenta(empresaId, hoy),
        this.repository.serieVentasHistorial(empresaId),
        this.repository.usaVariantes(empresaId),
      ]);
      productos = productosRes;
      ventas = ventasRes;
      historial = historialRes;
      diasHistorial = dias;
      serieForecast = serieHist;
      usaVariantes = usaVar;
      items = await this.repository.itemsDeVentas(empresaId, ventas.map((v) => v.id));
      if (moneda === 'USD') {
        // En dólares: ventas y precios viejos con el dólar de su día; precio y costo actuales, con el de hoy.
        const fechas = [...serieForecast.map((p) => p.fecha), ...historial.map((h) => h.desde.slice(0, 10)), ...ventas.map((v) => v.fechaIso.slice(0, 10))].filter(Boolean).sort();
        const conv = await this.cotizaciones.conversor(empresaId, moneda, fechas[0] ?? hoy, hoy);
        productos = productos.map((p) => ({ ...p, costo: p.costo / conv.hoy, precioVenta: p.precioVenta / conv.hoy }));
        ventas = ventas.map((v) => ({ ...v, total: conv.a(v.total, v.fechaIso.slice(0, 10)) }));
        historial = historial.map((h) => ({ ...h, precio: conv.a(h.precio, h.desde.slice(0, 10)) }));
        serieForecast = serieForecast.map((p) => ({ ...p, total: conv.a(p.total, p.fecha) }));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar los datos';
      return { ...VACIO, errores: { radar: msg, elasticidad: msg, forecast: msg, variantes: msg, precio: msg } };
    }

    let elasticidades: FilaElasticidad[] = [];
    try {
      elasticidades = calcularElasticidades(productos, historial, ventas, items, hoy);
    } catch (e) {
      errores.elasticidad = e instanceof Error ? e.message : 'No se pudo calcular la elasticidad';
    }

    let salud: InsightSalud | null = null;
    try {
      const ventasMes = ventas.filter((v) => v.fechaIso >= mesIni).reduce((a, v) => a + v.total, 0);
      // Mismos días del mes anterior (1 al N): comparar el mes en curso contra
      // el mes anterior completo hacía que las ventas siempre "bajaran".
      const diaHoy = Number(hoy.slice(8, 10));
      const mesAntTope = sumarDiasIso(mesAntIni, diaHoy - 1) < mesAntFin ? sumarDiasIso(mesAntIni, diaHoy - 1) : mesAntFin;
      const ventasMesAnt = ventas.filter((v) => v.fechaIso >= mesAntIni && v.fechaIso <= mesAntTope).reduce((a, v) => a + v.total, 0);
      const hayMesAnterior = ventas.some((v) => v.fechaIso >= mesAntIni && v.fechaIso <= mesAntFin);
      salud = calcularSalud({ ventasMes, ventasMesAnt, hayMesAnterior, productos, ventas, elasticidades });
    } catch (e) {
      errores.radar = e instanceof Error ? e.message : 'No se pudo armar el radar';
    }

    const serieDiaria = serieForecast.length > 0 ? serieForecast : serieDiariaDe(ventas, desdeFetch, hoy);

    let forecast = null;
    try {
      if (diasHistorial >= 30) forecast = armarForecast(serieDiaria, pronostico, diasHistorial, hoy);
    } catch (e) {
      errores.forecast = e instanceof Error ? e.message : 'No se pudo calcular la proyección';
    }

    let variantes: InsightVariantes | null = null;
    if (usaVariantes) {
      try {
        const vars = await this.repository.variantesDeProductos(empresaId, productos.map((p) => p.id));
        const ids = vars.map((v) => v.id);
        const slices: string[][] = [];
        for (let i = 0; i < ids.length; i += 200) slices.push(ids.slice(i, i + 200));
        const partes = await Promise.all(slices.map((slice) => this.repository.stockPorVariante(empresaId, slice)));
        const stock = new Map<string, number>();
        for (const part of partes) for (const [k, val] of part) stock.set(k, val);
        const dist = armarVariantes(items, ventas, vars, stock, hoy);
        variantes = dist.hayVentas ? dist : { hayVentas: false, porAtributo: [], combinaciones: [], bullets: [] };
      } catch (e) {
        errores.variantes = e instanceof Error ? e.message : 'No se pudo armar la distribución';
      }
    }

    let precios: InsightsPayload['precios'] = [];
    try {
      precios = preciosOptimos(productos, elasticidades, items, ventas, mesIni);
    } catch (e) {
      errores.precio = e instanceof Error ? e.message : 'No se pudo estimar el precio óptimo';
    }

    return { salud, elasticidades, forecast, serieDiaria, diasHistorial, variantes, precios, errores };
  }
}
