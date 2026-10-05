import { Prisma } from '@prisma/client';
import { diaAR } from './fecha-sql.js';
import type { PrismaService } from '../../database/prisma.service.js';
import { EN_PESOS, type Conversor } from '../cotizaciones/conversor.js';

export interface DineroDevolucionProducto {
  productoId: string;
  nombre: string;
  /** Unidades netas: negativo = devueltas, positivo = entregadas en un cambio. */
  unidades: number;
  /** Ingreso neto: negativo = reintegro al cliente, positivo = diferencia que pagó en un cambio. */
  ingreso: number;
  /** Costo neto de esas unidades (las devueltas vuelven al stock y restan costo). */
  costo: number;
}

/**
 * Efecto en dinero de las devoluciones y cambios de un rango (por la fecha
 * de la devolución; las canceladas no cuentan). Lo devuelto resta ingreso al
 * precio de la venta original y resta el costo que se congeló en esa venta;
 * lo entregado en un cambio suma ingreso a su precio y costo al costo actual.
 */
export async function dineroDevoluciones(
  prisma: PrismaService,
  empresaId: string,
  desde: Date,
  hasta: Date,
  conv: Conversor = EN_PESOS,
): Promise<DineroDevolucionProducto[]> {
  const filas = await prisma.$queryRaw<{ producto_id: string; nombre: string; unidades: string; ingreso: string; costo: string }[]>(Prisma.sql`
    SELECT
      di.producto_id,
      p.nombre,
      SUM(CASE WHEN di.tipo = 'devuelto' THEN -di.cantidad ELSE di.cantidad END) AS unidades,
      SUM(CASE WHEN di.tipo = 'devuelto' THEN -1 ELSE 1 END * di.cantidad * di.precio_unitario * ${conv.factor(diaAR(Prisma.raw('d.fecha')))}) AS ingreso,
      SUM(CASE WHEN di.tipo = 'devuelto' THEN -1 ELSE 1 END * di.cantidad * COALESCE(
        CASE WHEN di.tipo = 'devuelto' THEN (
          SELECT NULLIF(vi.costo_unitario, 0) FROM ventas_items vi
          WHERE vi.venta_id = d.venta_id AND vi.producto_id = di.producto_id
            AND vi.variante_id IS NOT DISTINCT FROM di.variante_id
          LIMIT 1
        ) END,
        pv.costo, p.costo, 0
      ) * ${conv.factor(diaAR(Prisma.raw('d.fecha')))}) AS costo
    FROM devoluciones d
    JOIN devoluciones_items di ON di.devolucion_id = d.id
    JOIN productos p ON p.id = di.producto_id
    LEFT JOIN producto_variantes pv ON pv.id = di.variante_id
    WHERE d.empresa_id = ${empresaId}::uuid AND d.deleted_at IS NULL AND d.estado <> 'cancelado'
      AND d.fecha >= ${desde} AND d.fecha <= ${hasta}
    GROUP BY di.producto_id, p.nombre
  `);
  return filas.map((f) => ({
    productoId: f.producto_id,
    nombre: f.nombre,
    unidades: Number(f.unidades),
    ingreso: Number(f.ingreso),
    costo: Number(f.costo),
  }));
}

export function sumarDinero(filas: DineroDevolucionProducto[]) {
  return filas.reduce((acc, f) => ({ ingreso: acc.ingreso + f.ingreso, costo: acc.costo + f.costo }), { ingreso: 0, costo: 0 });
}

/** Igual que dineroDevoluciones pero agrupado por día (fecha local AR), para series mensuales. */
export async function dineroDevolucionesPorDia(
  prisma: PrismaService,
  empresaId: string,
  desde: Date,
  hasta: Date,
  conv: Conversor = EN_PESOS,
): Promise<{ fecha: string; ingreso: number; costo: number }[]> {
  const filas = await prisma.$queryRaw<{ fecha: string; ingreso: string; costo: string }[]>(Prisma.sql`
    SELECT
      (${diaAR(Prisma.raw('d.fecha'))})::text AS fecha,
      SUM(CASE WHEN di.tipo = 'devuelto' THEN -1 ELSE 1 END * di.cantidad * di.precio_unitario * ${conv.factor(diaAR(Prisma.raw('d.fecha')))}) AS ingreso,
      SUM(CASE WHEN di.tipo = 'devuelto' THEN -1 ELSE 1 END * di.cantidad * COALESCE(
        CASE WHEN di.tipo = 'devuelto' THEN (
          SELECT NULLIF(vi.costo_unitario, 0) FROM ventas_items vi
          WHERE vi.venta_id = d.venta_id AND vi.producto_id = di.producto_id
            AND vi.variante_id IS NOT DISTINCT FROM di.variante_id
          LIMIT 1
        ) END,
        pv.costo, p.costo, 0
      ) * ${conv.factor(diaAR(Prisma.raw('d.fecha')))}) AS costo
    FROM devoluciones d
    JOIN devoluciones_items di ON di.devolucion_id = d.id
    JOIN productos p ON p.id = di.producto_id
    LEFT JOIN producto_variantes pv ON pv.id = di.variante_id
    WHERE d.empresa_id = ${empresaId}::uuid AND d.deleted_at IS NULL AND d.estado <> 'cancelado'
      AND d.fecha >= ${desde} AND d.fecha <= ${hasta}
    GROUP BY 1
  `);
  return filas.map((f) => ({ fecha: f.fecha, ingreso: Number(f.ingreso), costo: Number(f.costo) }));
}
