import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { dineroDevolucionesPorDia } from '../analytics/devoluciones-dinero.js';
import { diaAR } from '../analytics/fecha-sql.js';
import type { ContabilidadRepository, ValorStock } from './contabilidad.repository.js';
import type { ItemCogs, VentaConCogs } from './contabilidad.util.js';
import { sumarDiasIso } from '../analytics/analytics.util.js';

@Injectable()
export class PrismaContabilidadRepository implements ContabilidadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ventasConItems(empresaId: string, desde: string, hasta: string): Promise<{ ventas: VentaConCogs[]; items: ItemCogs[] }> {
    const desdeDate = new Date(`${desde}T00:00:00.000-03:00`);
    const hastaDate = new Date(`${sumarDiasIso(hasta, 1)}T00:00:00.000-03:00`);
    // Una sola consulta con el costo ya sumado por venta (antes se traían los ítems
    // en tandas de 200 ventas: con 21.000 ventas eran 106 consultas).
    const [filas, ajustes] = await Promise.all([
      this.prisma.$queryRaw<{ id: string; fecha: string; total: string | null; cogs: string }[]>(Prisma.sql`
        SELECT v.id, ${diaAR(Prisma.raw('v.fecha'))}::text AS fecha, v.total_con_interes AS total,
               COALESCE(SUM(vi.cantidad * vi.costo_unitario), 0) AS cogs
        FROM ventas v
        LEFT JOIN ventas_items vi ON vi.venta_id = v.id
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL AND v.fecha >= ${desdeDate} AND v.fecha < ${hastaDate}
        GROUP BY v.id
      `),
      dineroDevolucionesPorDia(this.prisma, empresaId, desdeDate, hastaDate),
    ]);
    // Fecha local AR (diaAR): una venta del 31/08 a las 22 h es de agosto.
    const ventasOut: VentaConCogs[] = filas.map((v) => ({ id: v.id, fecha: v.fecha, total: Number(v.total ?? 0) }));
    const items: ItemCogs[] = filas.map((v) => ({ ventaId: v.id, cogs: Number(v.cogs) }));
    ventasOut.push(...ajustes.map((a) => ({ id: `devoluciones-${a.fecha}`, fecha: a.fecha, total: a.ingreso, esAjuste: true })));
    items.push(...ajustes.map((a) => ({ ventaId: `devoluciones-${a.fecha}`, cogs: a.costo })));
    return { ventas: ventasOut, items };
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
