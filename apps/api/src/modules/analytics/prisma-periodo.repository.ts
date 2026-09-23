import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  AnalyticsEvolucionPunto,
  AnalyticsFormaPago,
  AnalyticsPeriodoBase,
  AnalyticsPeriodoRepository,
  AnalyticsTopProducto,
  GranularidadPeriodo,
} from './periodo.repository.js';
import { sumarDiasIso } from './analytics.util.js';

const DIA_VENTA = Prisma.sql`date(v.fecha AT TIME ZONE 'America/Argentina/Mendoza')`;

/** Puerto de monto_venta() (068_senias.sql): cobrado con fallback total_con_interes > total_sin_interes > (items - descuento), menos saldo pendiente, piso en 0. */
const MONTO_VENTA = Prisma.sql`
  GREATEST(
    COALESCE(
      NULLIF(v.total_con_interes, 0),
      NULLIF(v.total_sin_interes, 0),
      (SELECT COALESCE(SUM(i.precio_unitario * i.cantidad), 0) - COALESCE(v.descuento, 0) FROM ventas_items i WHERE i.venta_id = v.id)
    ) - COALESCE(v.saldo_pendiente, 0),
    0
  )
`;

const UNIDAD_TRUNC: Record<GranularidadPeriodo, string> = { dia: 'day', semana: 'week', mes: 'month' };

@Injectable()
export class PrismaAnalyticsPeriodoRepository implements AnalyticsPeriodoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async contarVentas(empresaId: string, desde: string, hasta: string): Promise<number> {
    const filas = await this.prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM ventas v
      WHERE v.empresa_id = ${empresaId}::uuid
        AND v.deleted_at IS NULL
        AND ${DIA_VENTA} BETWEEN ${desde}::date AND ${hasta}::date
    `);
    return Number(filas[0]?.total ?? 0);
  }

  async periodoBase(empresaId: string, desde: string, hasta: string): Promise<AnalyticsPeriodoBase> {
    const filas = await this.prisma.$queryRaw<
      {
        total_ventas: string;
        cantidad: bigint;
        ticket_promedio: string;
        costo: string;
        por_cobrar: string;
        ventas: { fecha: string; total: number; forma_pago: string }[];
        productos: { producto: string; unidades: number; total: number; costo: number; margen: number; margen_pct: number }[];
      }[]
    >(Prisma.sql`
      WITH periodo AS (
        SELECT
          v.id, v.fecha, v.forma_pago,
          GREATEST(COALESCE(v.total_con_interes, 0) - COALESCE(v.saldo_pendiente, 0), 0) AS cobrado,
          COALESCE(v.saldo_pendiente, 0) AS saldo
        FROM ventas v
        WHERE v.empresa_id = ${empresaId}::uuid
          AND v.fecha BETWEEN ${desde}::date AND ${hasta}::date
          AND v.deleted_at IS NULL
      ),
      costos AS (
        SELECT COALESCE(SUM(COALESCE(vi.costo_unitario, pr.costo, 0) * vi.cantidad), 0) AS costo
        FROM ventas_items vi
        JOIN periodo p ON p.id = vi.venta_id
        LEFT JOIN productos pr ON pr.id = vi.producto_id
      ),
      por_producto AS (
        SELECT
          COALESCE(pr.nombre, 'Producto') AS nombre,
          SUM(vi.cantidad)::int AS unidades,
          SUM(vi.cantidad * vi.precio_unitario) AS total,
          SUM(vi.cantidad * COALESCE(vi.costo_unitario, pr.costo, 0)) AS costo
        FROM ventas_items vi
        JOIN periodo p ON p.id = vi.venta_id
        LEFT JOIN productos pr ON pr.id = vi.producto_id
        GROUP BY COALESCE(pr.nombre, 'Producto')
      )
      SELECT
        COALESCE((SELECT SUM(cobrado) FROM periodo), 0) AS total_ventas,
        (SELECT COUNT(*) FROM periodo) AS cantidad,
        COALESCE((SELECT AVG(cobrado) FROM periodo), 0) AS ticket_promedio,
        (SELECT costo FROM costos) AS costo,
        COALESCE((SELECT SUM(saldo) FROM periodo), 0) AS por_cobrar,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('fecha', fecha, 'total', cobrado, 'forma_pago', forma_pago) ORDER BY fecha)
          FROM periodo
        ), '[]'::jsonb) AS ventas,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'producto', nombre, 'unidades', unidades, 'total', total, 'costo', costo,
            'margen', total - costo,
            'margen_pct', CASE WHEN total > 0 THEN round(((total - costo) / total) * 100, 1) ELSE 0 END
          ) ORDER BY total DESC, nombre)
          FROM por_producto
        ), '[]'::jsonb) AS productos
    `);
    const fila = filas[0];
    if (!fila) {
      return { totalVentas: 0, cantidad: 0, ticketPromedio: 0, costo: 0, porCobrar: 0, ventas: [], productos: [] };
    }
    return {
      totalVentas: Number(fila.total_ventas),
      cantidad: Number(fila.cantidad),
      ticketPromedio: Number(fila.ticket_promedio),
      costo: Number(fila.costo),
      porCobrar: Number(fila.por_cobrar),
      ventas: fila.ventas.map((v) => ({ fecha: new Date(v.fecha), total: Number(v.total), formaPago: v.forma_pago })),
      productos: fila.productos.map((p) => ({
        producto: p.producto,
        unidades: Number(p.unidades),
        total: Number(p.total),
        costo: Number(p.costo),
        margen: Number(p.margen),
        margenPct: Number(p.margen_pct),
      })),
    };
  }

  async evolucion(empresaId: string, desde: string, hasta: string, granularidad: GranularidadPeriodo): Promise<AnalyticsEvolucionPunto[]> {
    const unit = UNIDAD_TRUNC[granularidad];
    const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1;
    const hastaAnt = sumarDiasIso(desde, -1);
    const desdeAnt = sumarDiasIso(hastaAnt, -(dias - 1));
    const filas = await this.prisma.$queryRaw<{ periodo: string; total: string; anterior: string; cantidad: bigint }[]>(Prisma.sql`
      WITH actual AS (
        SELECT
          date_trunc(${unit}, (${DIA_VENTA})::timestamp)::date AS periodo,
          SUM(${MONTO_VENTA}) AS total,
          COUNT(*)::int AS cantidad
        FROM ventas v
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL
          AND ${DIA_VENTA} BETWEEN ${desde}::date AND ${hasta}::date
        GROUP BY 1
      ),
      anterior AS (
        SELECT
          date_trunc(${unit}, ((${DIA_VENTA}) + ${dias})::timestamp)::date AS periodo,
          SUM(${MONTO_VENTA}) AS total
        FROM ventas v
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL
          AND ${DIA_VENTA} BETWEEN ${desdeAnt}::date AND ${hastaAnt}::date
        GROUP BY 1
      )
      SELECT
        COALESCE(a.periodo, b.periodo) AS periodo,
        COALESCE(a.total, 0) AS total,
        COALESCE(b.total, 0) AS anterior,
        COALESCE(a.cantidad, 0) AS cantidad
      FROM actual a
      FULL JOIN anterior b ON b.periodo = a.periodo
      WHERE COALESCE(a.periodo, b.periodo) IS NOT NULL
      ORDER BY periodo
    `);
    return filas.map((f) => ({
      fecha: f.periodo.slice(0, 10),
      total: Number(f.total),
      anterior: Number(f.anterior),
      cantidad: Number(f.cantidad),
    }));
  }

  async formasPago(empresaId: string, desde: string, hasta: string): Promise<AnalyticsFormaPago[]> {
    const filas = await this.prisma.$queryRaw<{ forma: string; total: string; cantidad: bigint }[]>(Prisma.sql`
      SELECT p.forma, p.total, p.cantidad
      FROM (
        SELECT
          CASE v.forma_pago
            WHEN 'efectivo' THEN 'Efectivo'
            WHEN 'transferencia' THEN 'Transferencia'
            WHEN 'debito' THEN 'Débito'
            WHEN 'credito' THEN 'Crédito'
            WHEN 'qr' THEN 'MP QR'
            ELSE v.forma_pago
          END AS forma,
          SUM(${MONTO_VENTA}) AS total,
          COUNT(*)::int AS cantidad
        FROM ventas v
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL
          AND ${DIA_VENTA} BETWEEN ${desde}::date AND ${hasta}::date
        GROUP BY v.forma_pago
      ) p
      WHERE p.total > 0
      ORDER BY p.total DESC
    `);
    return filas.map((f) => ({ nombre: f.forma, total: Number(f.total), cantidad: Number(f.cantidad) }));
  }

  async topProductos(empresaId: string, desde: string, hasta: string): Promise<AnalyticsTopProducto[]> {
    const filas = await this.prisma.$queryRaw<{ nombre: string; unidades: number; total: string }[]>(Prisma.sql`
      SELECT p.nombre, SUM(vi.cantidad)::int AS unidades, SUM(vi.cantidad * vi.precio_unitario) AS total
      FROM ventas_items vi
      JOIN ventas v ON v.id = vi.venta_id
      JOIN productos p ON p.id = vi.producto_id
      WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL
        AND ${DIA_VENTA} BETWEEN ${desde}::date AND ${hasta}::date
      GROUP BY p.nombre
      ORDER BY SUM(vi.cantidad * vi.precio_unitario) DESC, p.nombre
      LIMIT 10
    `);
    return filas.map((f) => ({ nombre: f.nombre, unidades: Number(f.unidades), total: Number(f.total) }));
  }
}
