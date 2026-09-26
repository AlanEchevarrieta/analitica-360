import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../database/prisma.service.js';
import { diaAR } from '../analytics/fecha-sql.js';
import { TIPOS_PERDIDA } from './kardex.util.js';

/**
 * Mermas, roturas, pérdidas y consumo interno valuados a costo (el del
 * momento del ajuste; si no quedó guardado, el actual), por día en Argentina.
 * Lo usan el estado de resultados y la vista Contabilidad, así dan igual.
 */
export async function perdidasPorDia(prisma: PrismaService, empresaId: string, desde: string, hasta: string): Promise<{ fecha: string; monto: number }[]> {
  const dia = diaAR(Prisma.raw('m.fecha'));
  const filas = await prisma.$queryRaw<{ fecha: string; monto: string }[]>(Prisma.sql`
    SELECT to_char(${dia}, 'YYYY-MM-DD') AS fecha,
           SUM(m.cantidad * COALESCE(m.costo_unitario, v.costo, p.costo, 0)) AS monto
    FROM movimientos_inventario m
    -- El producto tiene que ser de la empresa (hay movimientos migrados que apuntan a otra).
    JOIN productos p ON p.id = m.producto_id AND p.empresa_id = ${empresaId}::uuid
    LEFT JOIN producto_variantes v ON v.id = m.variante_id
    WHERE m.empresa_id = ${empresaId}::uuid AND m.deleted_at IS NULL AND m.signo = -1
      AND m.tipo IN (${Prisma.join([...TIPOS_PERDIDA])})
      AND ${dia} BETWEEN ${desde}::date AND ${hasta}::date
    GROUP BY 1
  `);
  return filas.map((f) => ({ fecha: f.fecha, monto: Number(f.monto) }));
}
