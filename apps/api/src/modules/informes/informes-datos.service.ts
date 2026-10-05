import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { diaAR } from '../analytics/fecha-sql.js';
import { DashboardService } from '../analytics/dashboard.service.js';
import { AnalyticsPeriodoService } from '../analytics/periodo.service.js';
import { MonotributoService } from '../contabilidad/monotributo.service.js';
import { CuentaCorrienteService } from '../cuenta-corriente/cuenta-corriente.service.js';
import { completarDias, periodoPrevio, variacion, type Periodo, type TipoInforme } from './informes.util.js';

export interface Cifra {
  valor: number;
  anterior: number;
  variacion: number | null;
}

/** Todo lo que va en el informe (PDF y cuerpo del email). */
export interface DatosInforme {
  empresa: string;
  tipo: TipoInforme;
  periodo: Periodo;
  ventas: Cifra;
  cantidad: Cifra;
  ticket: Cifra;
  ganancia: Cifra;
  margenPct: number | null;
  /** Ventas por día del período (con 0 donde no hubo). */
  dias: { fecha: string; total: number }[];
  masVendidos: { nombre: string; unidades: number; total: number }[];
  formasPago: { nombre: string; total: number; cantidad: number }[];
  compras: Cifra;
  stockBajo: { nombre: string; stock: number }[];
  sinVentas: { cantidad: number; ejemplos: string[] };
  /** Solo en el mensual. */
  cuentaCorriente: { total: number; deudores: { nombre: string; saldo: number; dias: number }[] } | null;
  monotributo: { categoria: string | null; usoPct: number | null; margenDisponible: number | null; proyeccionAnual: number; categoriaProyectada: string | null } | null;
  /** Más de 50.000 ventas en el período: los números de detalle no se calculan. */
  demasiadasVentas: boolean;
}

const cifra = (valor: number, anterior: number): Cifra => ({ valor, anterior, variacion: variacion(valor, anterior) });
const FORMA_PAGO: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito', credito: 'Crédito', mp_qr: 'Mercado Pago QR' };

@Injectable()
export class InformesDatosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodos: AnalyticsPeriodoService,
    private readonly dashboard: DashboardService,
    private readonly cuentaCorriente: CuentaCorrienteService,
    private readonly monotributo: MonotributoService,
  ) {}

  async armar(empresaId: string, tipo: TipoInforme, periodo: Periodo): Promise<DatosInforme> {
    const previo = periodoPrevio(tipo, periodo);
    const [empresa, actual, anterior, inicio, sinVentas, mensual] = await Promise.all([
      this.prisma.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { nombre: true } }),
      this.periodos.periodo(empresaId, periodo.desde, periodo.hasta, 'dia'),
      this.periodos.periodo(empresaId, previo.desde, previo.hasta, 'dia'),
      this.dashboard.inicio(empresaId),
      this.sinVentas(empresaId, periodo),
      tipo === 'mensual' ? Promise.all([this.cuentaCorriente.resumen(empresaId), this.monotributo.estado(empresaId)]) : null,
    ]);
    const a = actual.data;
    const b = anterior.data;
    const total = a?.total ?? 0;
    const cant = a?.cantidad ?? 0;
    const ganancia = a ? a.total - a.costo : 0;
    const gananciaAnt = b ? b.total - b.costo : 0;
    const comprasDe = (d: typeof a) => (d?.comprasDiarias ?? []).reduce((s, x) => s + x.total, 0);
    const [cc, mono] = mensual ?? [null, null];
    return {
      empresa: empresa.nombre,
      tipo,
      periodo,
      ventas: cifra(total, b?.total ?? 0),
      cantidad: cifra(cant, b?.cantidad ?? 0),
      ticket: cifra(cant ? total / cant : 0, b?.cantidad ? b.total / b.cantidad : 0),
      ganancia: cifra(ganancia, gananciaAnt),
      margenPct: total > 0 ? Math.round((ganancia / total) * 1000) / 10 : null,
      dias: completarDias(periodo, a?.evolucionDiaria ?? []),
      masVendidos: [...(a?.productos ?? [])]
        .sort((x, y) => y.total - x.total)
        .slice(0, 5)
        .map((p) => ({ nombre: p.producto, unidades: p.unidades, total: p.total })),
      formasPago: [...(a?.formasPago ?? [])].sort((x, y) => y.total - x.total).map((f) => ({ ...f, nombre: FORMA_PAGO[f.nombre] ?? f.nombre })),
      compras: cifra(comprasDe(a), comprasDe(b)),
      stockBajo: inicio.alertasStock.slice(0, 6),
      sinVentas,
      cuentaCorriente: cc ? { total: cc.total, deudores: cc.deudores.slice(0, 5).map((d) => ({ nombre: d.nombre, saldo: d.saldo, dias: d.dias })) } : null,
      monotributo: mono?.estado
        ? {
            categoria: mono.estado.categoriaActual,
            usoPct: mono.estado.usoPct,
            margenDisponible: mono.estado.margenDisponible,
            proyeccionAnual: mono.estado.proyeccionAnual,
            categoriaProyectada: mono.estado.categoriaProyectada,
          }
        : null,
      demasiadasVentas: actual.avisoLimite != null,
    };
  }

  /** Productos a la venta que no se vendieron en el período (los insumos no cuentan). */
  private async sinVentas(empresaId: string, p: Periodo): Promise<{ cantidad: number; ejemplos: string[] }> {
    const filas = await this.prisma.$queryRaw<{ nombre: string; total: bigint }[]>(Prisma.sql`
      SELECT pr.nombre, COUNT(*) OVER () AS total
      FROM productos pr
      WHERE pr.empresa_id = ${empresaId}::uuid AND pr.activo AND pr.deleted_at IS NULL AND NOT pr.es_insumo
        AND NOT EXISTS (
          SELECT 1 FROM ventas_items vi JOIN ventas v ON v.id = vi.venta_id
          WHERE vi.producto_id = pr.id AND v.deleted_at IS NULL
            AND ${diaAR(Prisma.raw('v.fecha'))} BETWEEN ${p.desde}::date AND ${p.hasta}::date
        )
      ORDER BY pr.nombre
      LIMIT 5
    `);
    return { cantidad: Number(filas[0]?.total ?? 0), ejemplos: filas.map((f) => f.nombre) };
  }
}
