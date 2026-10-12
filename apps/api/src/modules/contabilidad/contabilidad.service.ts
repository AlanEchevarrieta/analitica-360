import { Inject, Injectable } from '@nestjs/common';
import { CONTABILIDAD_REPOSITORY, type ContabilidadRepository, type ValorStock } from './contabilidad.repository.js';
import { GASTO_REPOSITORY, type GastoRepository } from './gasto.repository.js';
import {
  equilibrioDelMes,
  type Equilibrio,
  acumuladoSerie,
  expandirRecurrentes,
  mesesAtras,
  proyectarFlujo,
  ratiosFinancieros,
  semaforoMargenBruto,
  semaforoMargenNeto,
  serieMensual,
  sumarPeriodo,
  type PuntoMesAcumulado,
  type RatiosFinancieros,
  type Semaforo,
  type TotalesPeriodo,
} from './contabilidad.util.js';
import { fechaHoyAR, sumarDiasIso } from '../analytics/analytics.util.js';
import { CotizacionesService, type Moneda } from '../cotizaciones/cotizaciones.service.js';

export interface ContabilidadRespuesta {
  totales: TotalesPeriodo;
  serie6: ReturnType<typeof serieMensual>;
  valorStock: ValorStock;
  ratios: RatiosFinancieros;
  semaforoMargenBruto: Semaforo;
  semaforoMargenNeto: Semaforo;
  proyeccion: ReturnType<typeof proyectarFlujo>;
  flujoHistorico: PuntoMesAcumulado[];
  flujoProyectado: PuntoMesAcumulado[];
}

@Injectable()
export class ContabilidadService {
  constructor(
    @Inject(CONTABILIDAD_REPOSITORY) private readonly repository: ContabilidadRepository,
    @Inject(GASTO_REPOSITORY) private readonly gastoRepository: GastoRepository,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  async contabilidad(empresaId: string, desde: string, hasta: string, moneda?: Moneda): Promise<ContabilidadRespuesta> {
    const hoy = fechaHoyAR();
    const claves6 = mesesAtras(hoy, 6);
    const desdeHist = `${claves6[0]}-01`;

    const [{ ventas: ventasArs, items: itemsArs }, gastosCargados, valorStockArs, perdidasArs, conv] = await Promise.all([
      this.repository.ventasConItems(empresaId, desdeHist, hoy),
      // Desde el principio: un recurrente cargado hace un año sigue generando gasto este mes.
      this.gastoRepository.listar(empresaId, '2000-01-01', hoy),
      this.repository.valorStock(empresaId),
      this.repository.perdidasPorDia(empresaId, desdeHist, hoy),
      this.cotizaciones.conversor(empresaId, moneda, desde < desdeHist ? desde : desdeHist, hoy),
    ]);
    // En dólares: cada venta, costo, gasto y pérdida con la cotización de su día; el stock (a costo actual), con la de hoy.
    const ventas = ventasArs.map((v) => ({ ...v, total: conv.a(v.total, v.fecha) }));
    const fechaVenta = new Map(ventasArs.map((v) => [v.id, v.fecha]));
    const items = itemsArs.map((i) => ({ ...i, cogs: conv.a(i.cogs, fechaVenta.get(i.ventaId) ?? hoy) }));
    const perdidas = perdidasArs.map((p) => ({ ...p, monto: conv.a(p.monto, p.fecha) }));
    const valorStock = {
      invertido: valorStockArs.invertido / conv.hoy,
      valorVenta: valorStockArs.valorVenta / conv.hoy,
      gananciaPotencial: valorStockArs.gananciaPotencial / conv.hoy,
    };

    // La mercadería perdida (mermas, roturas…) cuenta como un gasto más, igual que en el estado de resultados.
    const gastosHist = [
      ...expandirRecurrentes(gastosCargados, hoy)
        .filter((g) => g.fecha >= desdeHist)
        .map((g) => ({ ...g, monto: conv.a(g.monto, g.fecha) })),
      ...perdidas.map((p) => ({ fecha: p.fecha, monto: p.monto, recurrente: false, tipoCosto: 'variable' as const })),
    ];
    const serie6 = serieMensual(claves6, ventas, items, gastosHist);
    const totales = sumarPeriodo(ventas, items, gastosHist, desde, hasta);

    // Fijos = los gastos marcados como fijos (por defecto, los recurrentes); el resto, y las
    // pérdidas de mercadería, son variables y restan al margen que paga los fijos.
    const gastosPeriodo = gastosHist.filter((g) => g.fecha >= desde && g.fecha <= hasta);
    const gastosFijos = gastosPeriodo.filter((g) => g.tipoCosto === 'fijo').reduce((a, g) => a + g.monto, 0);

    const ratios = ratiosFinancieros({
      ingresos: totales.ingresos,
      cogs: totales.cogs,
      gastos: totales.gastos,
      cantidadVentas: totales.cantidadVentas,
      valorInventario: valorStock.invertido,
      gastosFijos: gastosFijos > 0 ? gastosFijos : totales.gastos,
      gastosVariables: gastosFijos > 0 ? totales.gastos - gastosFijos : 0,
      // Días transcurridos del período (hasta hoy si el período sigue abierto).
      diasPeriodo: Math.round((Date.parse(hasta < hoy ? hasta : hoy) - Date.parse(desde)) / 86_400_000) + 1,
    });

    // Los recurrentes se proyectan exactos según su frecuencia (hasta el último mes proyectado).
    const [y, m] = hoy.split('-').map(Number);
    const finProyeccion = new Date(Date.UTC(y, m + 3, 0)).toISOString().slice(0, 10);
    const recurrentesPorMes: Record<string, number> = {};
    for (const g of expandirRecurrentes(gastosCargados.filter((x) => x.recurrente && x.frecuencia), finProyeccion)) {
      if (g.fecha < desdeHist) continue;
      const clave = g.fecha.slice(0, 7);
      recurrentesPorMes[clave] = (recurrentesPorMes[clave] ?? 0) + conv.a(g.monto, g.fecha > hoy ? hoy : g.fecha);
    }
    const proyeccion = proyectarFlujo(serie6, 3, { hoy, recurrentesPorMes });
    const flujoHistorico = acumuladoSerie(serie6);
    const flujoProyectado = acumuladoSerie([...serie6, ...proyeccion]);

    return {
      totales,
      serie6,
      valorStock,
      ratios,
      semaforoMargenBruto: semaforoMargenBruto(ratios.margenBrutoPct),
      semaforoMargenNeto: semaforoMargenNeto(ratios.margenNetoPct),
      proyeccion,
      flujoHistorico,
      flujoProyectado,
    };
  }

  /**
   * Punto de equilibrio del mes en curso, para Inicio: cuánto hay que vender para cubrir los
   * costos fijos del mes, con el % de contribución de los últimos 90 días.
   */
  async equilibrio(empresaId: string, moneda?: Moneda): Promise<Equilibrio & { desde: string; hasta: string; fijosPorCategoria: { categoria: string; monto: number }[]; hayGastos: boolean }> {
    const hoy = fechaHoyAR();
    const desde = `${hoy.slice(0, 7)}-01`;
    const [a, m] = hoy.split('-').map(Number);
    const hasta = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
    const desdeRef = sumarDiasIso(hoy, -89);
    const inicio = desdeRef < desde ? desdeRef : desde;
    const [{ ventas: ventasArs, items: itemsArs }, gastosCargados, perdidasArs, conv] = await Promise.all([
      this.repository.ventasConItems(empresaId, inicio, hoy),
      this.gastoRepository.listar(empresaId, '2000-01-01', hasta),
      this.repository.perdidasPorDia(empresaId, inicio, hoy),
      this.cotizaciones.conversor(empresaId, moneda, inicio, hoy),
    ]);
    const ventas = ventasArs.map((v) => ({ ...v, total: conv.a(v.total, v.fecha) }));
    const fechaVenta = new Map(ventasArs.map((v) => [v.id, v.fecha]));
    const items = itemsArs.map((i) => ({ ...i, cogs: conv.a(i.cogs, fechaVenta.get(i.ventaId) ?? hoy) }));
    // Gastos hasta fin de mes: los recurrentes del resto del mes también son costos de este mes.
    const gastos = expandirRecurrentes(gastosCargados, hasta).map((g) => ({ ...g, monto: conv.a(g.monto, g.fecha <= hoy ? g.fecha : hoy) }));
    const fijosMes = gastos.filter((g) => g.tipoCosto === 'fijo' && g.fecha >= desde && g.fecha <= hasta);
    const variablesRef = [
      ...gastos.filter((g) => g.tipoCosto !== 'fijo' && g.fecha >= desdeRef && g.fecha <= hoy),
      ...perdidasArs.filter((p) => p.fecha >= desdeRef).map((p) => ({ fecha: p.fecha, monto: conv.a(p.monto, p.fecha), recurrente: false })),
    ];
    const ref = sumarPeriodo(ventas, items, variablesRef, desdeRef, hoy);
    const mes = sumarPeriodo(ventas, items, [], desde, hoy);
    const porCategoria = new Map<string, number>();
    for (const g of fijosMes) porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + g.monto);
    return {
      ...equilibrioDelMes({
        fijos: fijosMes.reduce((t, g) => t + g.monto, 0),
        ventasMes: mes.ingresos,
        referencia: { ventas: ref.ingresos, mercaderia: ref.cogs, gastosVariables: ref.gastos },
        desde,
        hasta,
        hoy,
      }),
      desde,
      hasta,
      fijosPorCategoria: [...porCategoria].map(([categoria, monto]) => ({ categoria, monto: Math.round(monto) })).sort((x, y) => y.monto - x.monto),
      hayGastos: gastosCargados.length > 0,
    };
  }
}
