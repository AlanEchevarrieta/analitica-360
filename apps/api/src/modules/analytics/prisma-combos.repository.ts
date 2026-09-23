import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { InsightCombo2, InsightCombo3, InsightsCombosRepository } from './combos.repository.js';

function numOrNull(v: string | number | null): number | null {
  return v == null ? null : Number(v);
}

@Injectable()
export class PrismaInsightsCombosRepository implements InsightsCombosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async combos(empresaId: string, limite: number): Promise<InsightCombo2[]> {
    const filas = await this.prisma.$queryRaw<
      {
        prod_a: string;
        prod_b: string;
        nombre_a: string;
        nombre_b: string;
        juntos: bigint;
        total: bigint;
        soporte: string;
        confianza_a: string;
        confianza_b: string;
        lift: string | null;
      }[]
    >(Prisma.sql`
      WITH ventas_empresa AS (
        SELECT v.id, COUNT(vi.id) AS items
        FROM ventas v
        JOIN ventas_items vi ON vi.venta_id = v.id
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL
        GROUP BY v.id
        HAVING COUNT(vi.id) > 1
      ),
      total AS (
        SELECT COUNT(*) AS total FROM ventas_empresa
      ),
      pares AS (
        SELECT a.producto_id AS prod_a, b.producto_id AS prod_b, COUNT(*) AS juntos
        FROM ventas_items a
        JOIN ventas_items b ON a.venta_id = b.venta_id AND a.producto_id < b.producto_id
        JOIN ventas_empresa ve ON ve.id = a.venta_id
        GROUP BY a.producto_id, b.producto_id
      ),
      frecuencia AS (
        SELECT vi.producto_id, COUNT(DISTINCT vi.venta_id) AS frecuencia
        FROM ventas_items vi
        JOIN ventas_empresa ve ON ve.id = vi.venta_id
        GROUP BY vi.producto_id
      )
      SELECT
        p.prod_a, p.prod_b, pa.nombre AS nombre_a, pb.nombre AS nombre_b, p.juntos, t.total,
        ROUND((p.juntos::numeric / NULLIF(t.total, 0)) * 100, 1) AS soporte,
        ROUND((p.juntos::numeric / NULLIF(fa.frecuencia, 0)) * 100, 1) AS confianza_a,
        ROUND((p.juntos::numeric / NULLIF(fb.frecuencia, 0)) * 100, 1) AS confianza_b,
        ROUND(
          (p.juntos::numeric / NULLIF(t.total, 0)) /
          NULLIF((fa.frecuencia::numeric / NULLIF(t.total, 0)) * (fb.frecuencia::numeric / NULLIF(t.total, 0)), 0),
          2
        ) AS lift
      FROM pares p
      JOIN productos pa ON pa.id = p.prod_a
      JOIN productos pb ON pb.id = p.prod_b
      JOIN frecuencia fa ON fa.producto_id = p.prod_a
      JOIN frecuencia fb ON fb.producto_id = p.prod_b
      CROSS JOIN total t
      WHERE p.juntos >= 3
      ORDER BY p.juntos DESC
      LIMIT ${limite}
    `);
    return filas.map((f) => ({
      productoAId: f.prod_a,
      productoBId: f.prod_b,
      nombreA: f.nombre_a,
      nombreB: f.nombre_b,
      vecesJuntos: Number(f.juntos),
      totalVentas: Number(f.total),
      soporte: Number(f.soporte),
      confianzaA: Number(f.confianza_a),
      confianzaB: Number(f.confianza_b),
      lift: numOrNull(f.lift),
    }));
  }

  async combos3(empresaId: string, limite: number): Promise<InsightCombo3[]> {
    const filas = await this.prisma.$queryRaw<
      { nombre_a: string; nombre_b: string; nombre_c: string; juntos: bigint; soporte: string; lift: string | null }[]
    >(Prisma.sql`
      WITH ventas_empresa AS (
        SELECT v.id
        FROM ventas v
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL
          AND (SELECT COUNT(*) FROM ventas_items vi WHERE vi.venta_id = v.id) >= 3
      ),
      total AS (
        SELECT COUNT(*) AS total FROM ventas_empresa
      ),
      trios AS (
        SELECT a.producto_id AS prod_a, b.producto_id AS prod_b, c.producto_id AS prod_c, COUNT(*) AS juntos
        FROM ventas_items a
        JOIN ventas_items b ON a.venta_id = b.venta_id AND a.producto_id < b.producto_id
        JOIN ventas_items c ON a.venta_id = c.venta_id AND b.producto_id < c.producto_id
        JOIN ventas_empresa ve ON ve.id = a.venta_id
        GROUP BY a.producto_id, b.producto_id, c.producto_id
        HAVING COUNT(*) >= 2
      ),
      frecuencia AS (
        SELECT vi.producto_id, COUNT(DISTINCT vi.venta_id) AS frecuencia
        FROM ventas_items vi
        JOIN ventas_empresa ve ON ve.id = vi.venta_id
        GROUP BY vi.producto_id
      )
      SELECT
        pa.nombre AS nombre_a, pb.nombre AS nombre_b, pc.nombre AS nombre_c, t.juntos,
        ROUND((t.juntos::numeric / NULLIF(tot.total, 0)) * 100, 1) AS soporte,
        ROUND(
          (t.juntos::numeric / NULLIF(tot.total, 0)) /
          NULLIF(
            (fa.frecuencia::numeric / NULLIF(tot.total, 0)) * (fb.frecuencia::numeric / NULLIF(tot.total, 0)) * (fc.frecuencia::numeric / NULLIF(tot.total, 0)),
            0
          ),
          2
        ) AS lift
      FROM trios t
      JOIN productos pa ON pa.id = t.prod_a
      JOIN productos pb ON pb.id = t.prod_b
      JOIN productos pc ON pc.id = t.prod_c
      JOIN frecuencia fa ON fa.producto_id = t.prod_a
      JOIN frecuencia fb ON fb.producto_id = t.prod_b
      JOIN frecuencia fc ON fc.producto_id = t.prod_c
      CROSS JOIN total tot
      ORDER BY t.juntos DESC
      LIMIT ${limite}
    `);
    return filas.map((f) => ({
      nombreA: f.nombre_a,
      nombreB: f.nombre_b,
      nombreC: f.nombre_c,
      vecesJuntos: Number(f.juntos),
      soporte: Number(f.soporte),
      lift: numOrNull(f.lift),
    }));
  }
}
