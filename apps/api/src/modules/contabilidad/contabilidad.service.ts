import { Inject, Injectable } from '@nestjs/common';
import { CONTABILIDAD_REPOSITORY, type ContabilidadRepository, type ValorStock } from './contabilidad.repository.js';
import { GASTO_REPOSITORY, type GastoRepository } from './gasto.repository.js';
import {
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
import { fechaHoyAR } from '../analytics/analytics.util.js';

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
  ) {}

  async contabilidad(empresaId: string, desde: string, hasta: string): Promise<ContabilidadRespuesta> {
    const hoy = fechaHoyAR();
    const claves6 = mesesAtras(hoy, 6);
    const desdeHist = `${claves6[0]}-01`;

    const [{ ventas, items }, gastosCargados, valorStock, perdidas] = await Promise.all([
      this.repository.ventasConItems(empresaId, desdeHist, hoy),
      // Desde el principio: un recurrente cargado hace un año sigue generando gasto este mes.
      this.gastoRepository.listar(empresaId, '2000-01-01', hoy),
      this.repository.valorStock(empresaId),
      this.repository.perdidasPorDia(empresaId, desdeHist, hoy),
    ]);

    // La mercadería perdida (mermas, roturas…) cuenta como un gasto más, igual que en el estado de resultados.
    const gastosHist = [
      ...expandirRecurrentes(gastosCargados, hoy).filter((g) => g.fecha >= desdeHist),
      ...perdidas.map((p) => ({ fecha: p.fecha, monto: p.monto, recurrente: false })),
    ];
    const serie6 = serieMensual(claves6, ventas, items, gastosHist);
    const totales = sumarPeriodo(ventas, items, gastosHist, desde, hasta);

    // gastosFijos se calcula sobre TODOS los gastos recurrentes del período pedido, no sobre
    // una lista filtrada por categoría como en la página legacy (ahí era estado de UI, acá
    // no hay ese filtro - un costo fijo no debería desaparecer del ratio por un filtro visual).
    const gastosPeriodo = gastosHist.filter((g) => g.fecha >= desde && g.fecha <= hasta);
    const gastosFijos = gastosPeriodo.filter((g) => g.recurrente).reduce((a, g) => a + g.monto, 0);

    const ratios = ratiosFinancieros({
      ingresos: totales.ingresos,
      cogs: totales.cogs,
      gastos: totales.gastos,
      cantidadVentas: totales.cantidadVentas,
      valorInventario: valorStock.invertido,
      gastosFijos: gastosFijos > 0 ? gastosFijos : totales.gastos,
      // Días transcurridos del período (hasta hoy si el período sigue abierto).
      diasPeriodo: Math.round((Date.parse(hasta < hoy ? hasta : hoy) - Date.parse(desde)) / 86_400_000) + 1,
    });

    const proyeccion = proyectarFlujo(serie6, 3);
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
}
