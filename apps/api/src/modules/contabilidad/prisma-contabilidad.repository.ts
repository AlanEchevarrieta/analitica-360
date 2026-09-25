import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { dineroDevolucionesPorDia } from '../analytics/devoluciones-dinero.js';
import { fechaLocalAR } from '../analytics/analytics.util.js';
import type { ContabilidadRepository, ValorStock } from './contabilidad.repository.js';
import type { ItemCogs, VentaConCogs } from './contabilidad.util.js';
import { sumarDiasIso } from '../analytics/analytics.util.js';

@Injectable()
export class PrismaContabilidadRepository implements ContabilidadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ventasConItems(empresaId: string, desde: string, hasta: string): Promise<{ ventas: VentaConCogs[]; items: ItemCogs[] }> {
    const desdeDate = new Date(`${desde}T00:00:00.000-03:00`);
    const hastaDate = new Date(`${sumarDiasIso(hasta, 1)}T00:00:00.000-03:00`);
    const ventas = await this.prisma.venta.findMany({
      where: { empresaId, deletedAt: null, fecha: { gte: desdeDate, lt: hastaDate } },
      select: { id: true, fecha: true, totalConInteres: true },
    });
    // Fecha local AR: con toISOString() una venta del 31/08 a las 22 h caía en septiembre.
    const ventasOut: VentaConCogs[] = ventas.map((v) => ({ id: v.id, fecha: fechaLocalAR(v.fecha), total: v.totalConInteres?.toNumber() ?? 0 }));
    const ajustes = await dineroDevolucionesPorDia(this.prisma, empresaId, desdeDate, hastaDate);

    const ids = ventasOut.map((v) => v.id);
    const itemsAjuste: ItemCogs[] = ajustes.map((a) => ({ ventaId: `devoluciones-${a.fecha}`, cogs: a.costo }));
    ventasOut.push(...ajustes.map((a) => ({ id: `devoluciones-${a.fecha}`, fecha: a.fecha, total: a.ingreso, esAjuste: true })));
    if (ids.length === 0) return { ventas: ventasOut, items: itemsAjuste };
    const slices: string[][] = [];
    for (let i = 0; i < ids.length; i += 200) slices.push(ids.slice(i, i + 200));
    const paginas = await Promise.all(
      slices.map((slice) =>
        this.prisma.ventaItem.findMany({ where: { empresaId, ventaId: { in: slice } }, select: { ventaId: true, cantidad: true, costoUnitario: true } }),
      ),
    );
    const items: ItemCogs[] = paginas.flat().map((it) => ({ ventaId: it.ventaId, cogs: it.cantidad * it.costoUnitario.toNumber() }));
    return { ventas: ventasOut, items: [...items, ...itemsAjuste] };
  }

  async valorStock(empresaId: string): Promise<ValorStock> {
    const filas = await this.prisma.$queryRaw<{ invertido: string; valor_venta: string }[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(t.stock * t.costo), 0) AS invertido,
        COALESCE(SUM(t.stock * t.precio_venta), 0) AS valor_venta
      FROM (
        SELECT
          COALESCE(p.costo, 0) AS costo,
          COALESCE(p.precio_venta, 0) AS precio_venta,
          COALESCE((
            SELECT SUM(m.cantidad * m.signo) FROM movimientos_inventario m
            WHERE m.producto_id = p.id AND m.empresa_id = ${empresaId}::uuid AND m.deleted_at IS NULL
          ), 0) AS stock
        FROM productos p
        WHERE p.empresa_id = ${empresaId}::uuid AND p.deleted_at IS NULL
      ) t
      WHERE t.stock > 0
    `);
    const invertido = Number(filas[0]?.invertido ?? 0);
    const valorVenta = Number(filas[0]?.valor_venta ?? 0);
    return { invertido, valorVenta, gananciaPotencial: valorVenta - invertido };
  }
}
