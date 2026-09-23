import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { InsightsRepository } from './insights.repository.js';
import type { HistorialPrecio, InsightProducto, ItemInsight, PuntoSerieDia, VarianteInsight, VentaInsight } from './insights.util.js';
import { fechaLocalAR, sumarDiasIso } from './analytics.util.js';

const DIA_VENTA = Prisma.sql`date(fecha AT TIME ZONE 'America/Argentina/Mendoza')`;

function rangoAR(iso: string): { desde: Date; hasta: Date } {
  return { desde: new Date(`${iso}T00:00:00.000-03:00`), hasta: new Date(`${iso}T23:59:59.999-03:00`) };
}

@Injectable()
export class PrismaInsightsRepository implements InsightsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async productosConStock(empresaId: string): Promise<InsightProducto[]> {
    const filas = await this.prisma.$queryRaw<
      { id: string; nombre: string; costo: string; precio_venta: string; activo: boolean; stock: string }[]
    >(Prisma.sql`
      SELECT
        p.id, p.nombre, COALESCE(p.costo, 0) AS costo, COALESCE(p.precio_venta, 0) AS precio_venta, p.activo,
        COALESCE((
          SELECT SUM(m.cantidad * m.signo) FROM movimientos_inventario m
          WHERE m.producto_id = p.id AND m.empresa_id = ${empresaId}::uuid AND m.deleted_at IS NULL
        ), 0) AS stock
      FROM productos p
      WHERE p.empresa_id = ${empresaId}::uuid AND p.deleted_at IS NULL
    `);
    return filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      costo: Number(f.costo),
      precioVenta: Number(f.precio_venta),
      activo: f.activo,
      stockActual: Number(f.stock),
    }));
  }

  async ventasRango(empresaId: string, desde: string, hasta: string): Promise<VentaInsight[]> {
    const { desde: desdeDate } = rangoAR(sumarDiasIso(desde, -1));
    const { hasta: hastaDate } = rangoAR(hasta);
    const ventas = await this.prisma.venta.findMany({
      where: { empresaId, deletedAt: null, fecha: { gte: desdeDate, lte: hastaDate } },
      select: { id: true, fecha: true, clienteId: true, totalConInteres: true, totalSinInteres: true },
      orderBy: { fecha: 'asc' },
    });
    const out: VentaInsight[] = [];
    for (const v of ventas) {
      const fechaIso = fechaLocalAR(v.fecha);
      if (fechaIso < desde || fechaIso > hasta) continue;
      const con = v.totalConInteres?.toNumber() ?? 0;
      out.push({ id: v.id, fechaIso, clienteId: v.clienteId, total: con > 0 ? con : (v.totalSinInteres?.toNumber() ?? 0) });
    }
    return out;
  }

  async itemsDeVentas(empresaId: string, ventaIds: string[]): Promise<ItemInsight[]> {
    if (ventaIds.length === 0) return [];
    const out: ItemInsight[] = [];
    for (let i = 0; i < ventaIds.length; i += 200) {
      const slice = ventaIds.slice(i, i + 200);
      const items = await this.prisma.ventaItem.findMany({
        where: { empresaId, ventaId: { in: slice } },
        select: { ventaId: true, productoId: true, varianteId: true, cantidad: true },
      });
      for (const it of items) {
        out.push({ ventaId: it.ventaId, productoId: it.productoId, varianteId: it.varianteId, cantidad: it.cantidad });
      }
    }
    return out;
  }

  async historialPrecios(empresaId: string): Promise<HistorialPrecio[]> {
    const filas = await this.prisma.precioHistorial.findMany({
      where: { empresaId },
      select: { productoId: true, precioVenta: true, fechaDesde: true },
      orderBy: { fechaDesde: 'asc' },
    });
    return filas.map((f) => ({ productoId: f.productoId, precio: f.precioVenta.toNumber(), desde: f.fechaDesde.toISOString().slice(0, 10) }));
  }

  async diasDesdePrimeraVenta(empresaId: string, hoy: string): Promise<number> {
    const primera = await this.prisma.venta.findFirst({
      where: { empresaId, deletedAt: null },
      select: { fecha: true },
      orderBy: { fecha: 'asc' },
    });
    if (!primera) return 0;
    const first = fechaLocalAR(primera.fecha);
    const [y1, m1, d1] = first.split('-').map(Number);
    const [y2, m2, d2] = hoy.split('-').map(Number);
    const a = Date.UTC(y1, m1 - 1, d1);
    const b = Date.UTC(y2, m2 - 1, d2);
    return Math.max(0, Math.round((b - a) / 86_400_000) + 1);
  }

  async serieVentasHistorial(empresaId: string): Promise<PuntoSerieDia[]> {
    const filas = await this.prisma.$queryRaw<{ dia: string; total: string }[]>(Prisma.sql`
      SELECT ${DIA_VENTA} AS dia, SUM(COALESCE(total_con_interes, 0)) AS total
      FROM ventas
      WHERE empresa_id = ${empresaId}::uuid AND deleted_at IS NULL
      GROUP BY 1
      ORDER BY 1
    `);
    return filas.map((f) => ({ fecha: f.dia.slice(0, 10), total: Number(f.total) }));
  }

  async usaVariantes(empresaId: string): Promise<boolean> {
    const config = await this.prisma.configuracionEmpresa.findUnique({ where: { empresaId }, select: { usaVariantes: true } });
    return config?.usaVariantes ?? false;
  }

  async variantesDeProductos(empresaId: string, productoIds: string[]): Promise<VarianteInsight[]> {
    if (productoIds.length === 0) return [];
    const variantes = await this.prisma.productoVariante.findMany({
      where: { empresaId, productoId: { in: productoIds }, deletedAt: null },
      select: { id: true, productoId: true, atributos: true },
    });
    return variantes.map((v) => ({ id: v.id, productoId: v.productoId, atributos: (v.atributos as Record<string, string>) ?? {} }));
  }

  async stockPorVariante(empresaId: string, varianteIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (varianteIds.length === 0) return out;
    const filas = await this.prisma.$queryRaw<{ variante_id: string; stock: string }[]>(Prisma.sql`
      SELECT variante_id, SUM(cantidad * signo) AS stock
      FROM movimientos_inventario
      WHERE empresa_id = ${empresaId}::uuid AND deleted_at IS NULL
        AND variante_id IN (${Prisma.join(varianteIds.map((id) => Prisma.sql`${id}::uuid`))})
      GROUP BY variante_id
    `);
    for (const f of filas) out.set(f.variante_id, Number(f.stock));
    return out;
  }
}
