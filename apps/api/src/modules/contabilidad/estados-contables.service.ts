import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { expandirRecurrentes } from './contabilidad.util.js';
import { GASTO_REPOSITORY, type GastoRepository } from './gasto.repository.js';
import {
  ESTADOS_CONTABLES_REPOSITORY,
  type DeudaProveedor,
  type EstadosContablesRepository,
  type MovimientoFinanciero,
} from './estados-contables.repository.js';
import {
  balanceAl,
  estadoResultados,
  evolucionPatrimonio,
  flujoEfectivo,
  indicadores,
  movimientosDeCaja,
  sumarDias,
  type Balance,
  type DatosContables,
  type EstadoResultados,
  type EvolucionPatrimonio,
  type FlujoEfectivo,
  type Indicadores,
  type ResultadoDia,
} from './estados-contables.util.js';
import type { CrearMovimientoFinancieroDto } from './estados-contables.dto.js';

export interface EstadosContablesRespuesta {
  desde: string;
  /** Fecha de cierre (el hasta pedido, sin pasar de hoy). */
  hasta: string;
  resultados: EstadoResultados;
  balanceInicio: Balance;
  balanceCierre: Balance;
  evolucion: EvolucionPatrimonio;
  flujo: FlujoEfectivo;
  indicadores: Indicadores;
  deudaPorProveedor: DeudaProveedor[];
  notas: { criterios: string[]; avisos: string[] };
}

const CRITERIOS = [
  'Moneda: pesos argentinos nominales, sin ajuste por inflación.',
  'Las ventas se reconocen el día en que se registran; las devoluciones y cambios, el día en que se procesan.',
  'Costo de la mercadería vendida: costo promedio ponderado congelado en cada venta (incluye flete e impuestos de las compras prorrateados).',
  'Bienes de cambio (stock): unidades a la fecha de cierre valuadas al costo promedio actual de cada producto.',
  'Ventas con tarjeta o en cuotas: se consideran cobradas el día de la venta (no se registra la acreditación posterior).',
  'Bienes de uso: amortización en línea recta por meses cumplidos según la vida útil cargada.',
  'Gastos recurrentes: se computan en cada período según su frecuencia (semanal, quincenal o mensual).',
];

@Injectable()
export class EstadosContablesService {
  constructor(
    @Inject(ESTADOS_CONTABLES_REPOSITORY) private readonly repository: EstadosContablesRepository,
    @Inject(GASTO_REPOSITORY) private readonly gastoRepository: GastoRepository,
  ) {}

  private async datos(empresaId: string, hasta: string): Promise<DatosContables> {
    const [ventasDia, devoluciones, gastos, cobros, senias, compras, movimientos] = await Promise.all([
      this.repository.ventasPorDia(empresaId, hasta),
      this.repository.devolucionesPorDia(empresaId, hasta),
      this.gastoRepository.listar(empresaId, '2000-01-01', hasta),
      this.repository.cobrosPorDia(empresaId, hasta),
      this.repository.senias(empresaId, hasta),
      this.repository.compras(empresaId, hasta),
      this.repository.movimientosDatos(empresaId, hasta),
    ]);
    // Totales por día (agregados en la base) y, aparte, el ajuste de devoluciones de cada día.
    const resultados: ResultadoDia[] = [
      ...ventasDia.map((v) => ({ fecha: v.fecha, ingreso: v.ingreso, cogs: v.cogs, esAjuste: false, ventas: v.ventas })),
      ...devoluciones.map((d) => ({ fecha: d.fecha, ingreso: d.ingreso, cogs: d.costo, esAjuste: true })),
    ];
    return {
      cobros,
      resultados,
      gastos: expandirRecurrentes(gastos, hasta).map((g) => ({ fecha: g.fecha, monto: g.monto, categoria: g.categoria })),
      compras,
      senias,
      movimientos,
    };
  }

  async estados(empresaId: string, desde: string, hastaPedido: string): Promise<EstadosContablesRespuesta> {
    const hoy = fechaHoyAR();
    const hasta = hastaPedido > hoy ? hoy : hastaPedido;
    if (desde > hasta) throw new BadRequestException('El período empieza después de hoy');
    const antesDeDesde = sumarDias(desde, -1);

    const [d, stockInicio, stockCierre, deudaPorProveedor] = await Promise.all([
      this.datos(empresaId, hasta),
      this.repository.valorStockAl(empresaId, antesDeDesde),
      this.repository.valorStockAl(empresaId, hasta),
      this.repository.deudaPorProveedor(empresaId, hasta),
    ]);
    const caja = movimientosDeCaja(d);
    const cantidadVentas = d.resultados.filter((r) => !r.esAjuste && r.fecha >= desde && r.fecha <= hasta).reduce((a, r) => a + (r.ventas ?? 1), 0);
    const resultados = estadoResultados(d, desde, hasta, cantidadVentas);
    const balanceInicio = balanceAl(d, antesDeDesde, stockInicio, caja);
    const balanceCierre = balanceAl(d, hasta, stockCierre, caja);
    const evolucion = evolucionPatrimonio(d, desde, hasta, balanceInicio, balanceCierre, resultados.resultadoNeto);
    const flujo = flujoEfectivo(d, desde, hasta, caja);

    const avisos: string[] = [];
    if (balanceCierre.activo.cajaEstimada) {
      avisos.push(
        'Todavía no cargaste un arqueo de caja: la plata disponible se calcula desde cero con todo lo registrado. Cargá cuánta plata tenías un día (efectivo + bancos + billeteras) y queda exacta.',
      );
    }
    if (balanceCierre.activo.caja < 0) {
      avisos.push('La caja da negativa: seguramente faltan registrar aportes de los dueños (plata que pusieron para comprar) o un arqueo de caja.');
    }
    if (Math.abs(balanceCierre.patrimonioNeto.capitalInicialYAjustes) >= 1) {
      avisos.push(
        '"Capital inicial y ajustes" es lo que el negocio ya tenía antes de empezar a registrar (stock y plata iniciales) más ajustes de stock (roturas, recuentos) y diferencias de caja. Se achica a medida que cargás arqueos y aportes.',
      );
    }
    if (d.compras.every((c) => !c.aCredito) && !d.movimientos.some((m) => m.tipo === 'pago_proveedor')) {
      avisos.push('Todas las compras figuran pagadas de contado. Si le debés a algún proveedor, marcá la compra como "a crédito" para verla en el pasivo.');
    }

    return {
      desde,
      hasta,
      resultados,
      balanceInicio,
      balanceCierre,
      evolucion,
      flujo,
      indicadores: indicadores(balanceInicio, balanceCierre, resultados.resultadoNeto),
      deudaPorProveedor,
      notas: { criterios: CRITERIOS, avisos },
    };
  }

  listarMovimientos(empresaId: string, desde: string, hasta: string): Promise<MovimientoFinanciero[]> {
    return this.repository.listarMovimientos(empresaId, desde, hasta);
  }

  async crearMovimiento(empresaId: string, usuarioId: string, dto: CrearMovimientoFinancieroDto): Promise<MovimientoFinanciero> {
    const r = await this.repository.crearMovimiento({ empresaId, usuarioId, ...dto });
    if (!r.ok) throw new BadRequestException('El proveedor no existe');
    return r.movimiento;
  }

  async anularMovimiento(empresaId: string, id: string): Promise<void> {
    const r = await this.repository.anularMovimiento(empresaId, id);
    if (!r.ok) throw new NotFoundException(r.motivo === 'ya_anulado' ? 'El movimiento ya estaba anulado' : 'Movimiento no encontrado');
  }
}
