import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  DashboardDiaSerie,
  DashboardInicioBase,
  DashboardRepository,
  DashboardStockItem,
  DashboardTopProducto,
  RangoHome,
} from './dashboard.repository.js';
import { etiquetaDiaEs, fechaHoyAR, fechaLocalAR, lunesIso, sumarDiasIso } from './analytics.util.js';

const selectParaTotal = {
  descuento: true,
  totalConInteres: true,
  totalSinInteres: true,
  items: { select: { cantidad: true, precioUnitario: true } },
} satisfies Prisma.VentaSelect;

type VentaParaTotal = Prisma.VentaGetPayload<{ select: typeof selectParaTotal }>;

/** Mismo fallback que el CASE del SQL: total_con_interes > total_sin_interes > (items - descuento). */
function totalDeVenta(v: VentaParaTotal): number {
  const con = v.totalConInteres?.toNumber() ?? 0;
  if (con > 0) return con;
  const sin = v.totalSinInteres?.toNumber() ?? 0;
  if (sin > 0) return sin;
  const itemsTotal = v.items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario.toNumber(), 0);
  return itemsTotal - v.descuento.toNumber();
}

function rangoDelDiaAR(iso: string): { desde: Date; hasta: Date } {
  return {
    desde: new Date(`${iso}T00:00:00.000-03:00`),
    hasta: new Date(`${iso}T23:59:59.999-03:00`),
  };
}

@Injectable()
export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async totalYCantidadEnRango(empresaId: string, desde: Date, hasta: Date): Promise<{ cantidad: number; total: number }> {
    const ventas = await this.prisma.venta.findMany({
      where: { empresaId, deletedAt: null, fecha: { gte: desde, lte: hasta } },
      select: selectParaTotal,
    });
    return { cantidad: ventas.length, total: ventas.reduce((acc, v) => acc + totalDeVenta(v), 0) };
  }

  private async topProductos(empresaId: string, desde: Date, hasta: Date, limite: number): Promise<DashboardTopProducto[]> {
    const filas = await this.prisma.$queryRaw<{ nombre: string; unidades: bigint }[]>(Prisma.sql`
      SELECT p.nombre, SUM(i.cantidad)::bigint AS unidades
      FROM ventas v
      JOIN ventas_items i ON i.venta_id = v.id
      JOIN productos p ON p.id = i.producto_id
      WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL
        AND v.fecha >= ${desde} AND v.fecha <= ${hasta}
      GROUP BY p.nombre
      ORDER BY SUM(i.cantidad) DESC, p.nombre
      LIMIT ${limite}
    `);
    return filas.map((f) => ({ nombre: f.nombre, unidades: Number(f.unidades) }));
  }

  private async serieDias(empresaId: string, hoy: string, dias: number, conCantidad: boolean): Promise<DashboardDiaSerie[]> {
    const desde = sumarDiasIso(hoy, -(dias - 1));
    const { desde: desdeDate } = rangoDelDiaAR(desde);
    const { hasta: hastaDate } = rangoDelDiaAR(hoy);
    const ventas = await this.prisma.venta.findMany({
      where: { empresaId, deletedAt: null, fecha: { gte: desdeDate, lte: hastaDate } },
      select: { fecha: true, ...selectParaTotal },
    });
    const porDia = new Map<string, { total: number; cantidad: number }>();
    for (const v of ventas) {
      const clave = fechaLocalAR(v.fecha);
      const actual = porDia.get(clave) ?? { total: 0, cantidad: 0 };
      actual.total += totalDeVenta(v);
      actual.cantidad += 1;
      porDia.set(clave, actual);
    }
    const out: DashboardDiaSerie[] = [];
    for (let i = 0; i < dias; i++) {
      const fecha = sumarDiasIso(desde, i);
      const v = porDia.get(fecha);
      out.push({
        fecha,
        dia: etiquetaDiaEs(fecha),
        total: v?.total ?? 0,
        ...(conCantidad ? { cantidad: v?.cantidad ?? 0 } : {}),
      });
    }
    return out;
  }

  private async stockActivoPorProducto(empresaId: string): Promise<DashboardStockItem[]> {
    const filas = await this.prisma.$queryRaw<{ nombre: string; stock: string }[]>(Prisma.sql`
      SELECT
        p.nombre,
        COALESCE((
          SELECT SUM(m.cantidad * m.signo) FROM movimientos_inventario m
          WHERE m.producto_id = p.id AND m.empresa_id = ${empresaId}::uuid AND m.deleted_at IS NULL
        ), 0) AS stock
      FROM productos p
      WHERE p.empresa_id = ${empresaId}::uuid AND p.deleted_at IS NULL AND p.activo = true
    `);
    return filas.map((f) => ({ nombre: f.nombre, stock: Number(f.stock) }));
  }

  private async umbralStockBajo(empresaId: string): Promise<number> {
    const config = await this.prisma.configuracionEmpresa.findUnique({ where: { empresaId } });
    const inv = config?.inventario as Record<string, unknown> | null;
    const umbral = Number(inv?.umbral_stock_bajo);
    return Number.isFinite(umbral) && umbral >= 0 ? umbral : 5;
  }

  async inicio(empresaId: string): Promise<DashboardInicioBase> {
    const hoy = fechaHoyAR();
    const lunes = lunesIso(hoy);
    const inicioMes = `${hoy.slice(0, 7)}-01`;
    const { desde: hoyDesde, hasta: hoyHasta } = rangoDelDiaAR(hoy);
    const semanaDesde = rangoDelDiaAR(lunes).desde;
    const mesDesde = rangoDelDiaAR(inicioMes).desde;

    const [hoyAgg, semanaAgg, mesAgg, comprasMesAgg, topHoyLista, top5, ultimos7, stock, umbral] = await Promise.all([
      this.totalYCantidadEnRango(empresaId, hoyDesde, hoyHasta),
      this.totalYCantidadEnRango(empresaId, semanaDesde, hoyHasta),
      this.totalYCantidadEnRango(empresaId, mesDesde, hoyHasta),
      this.prisma.compra.aggregate({
        where: { empresaId, deletedAt: null, fecha: { gte: mesDesde, lte: hoyHasta } },
        _sum: { total: true },
      }),
      this.topProductos(empresaId, hoyDesde, hoyHasta, 1),
      this.topProductos(empresaId, semanaDesde, hoyHasta, 5),
      this.serieDias(empresaId, hoy, 7, false),
      this.stockActivoPorProducto(empresaId),
      this.umbralStockBajo(empresaId),
    ]);

    const alertasStock = stock
      .filter((s) => s.stock <= umbral)
      .sort((a, b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre, 'es'));

    return {
      hoy: hoyAgg,
      semana: semanaAgg.total,
      mes: mesAgg.total,
      comprasMes: comprasMesAgg._sum.total?.toNumber() ?? 0,
      topHoy: topHoyLista[0] ?? null,
      ultimos7,
      top5,
      stock,
      alertasStock,
    };
  }

  async serieHome(empresaId: string, dias: RangoHome): Promise<DashboardDiaSerie[]> {
    return this.serieDias(empresaId, fechaHoyAR(), dias, true);
  }
}
