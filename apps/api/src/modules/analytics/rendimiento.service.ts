import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { diaAR } from './fecha-sql.js';
import { periodoAnterior, rendimiento, type FilaVentas } from './rendimiento.util.js';

@Injectable()
export class RendimientoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ventas del período por stand (ubicación de la que salió la mercadería) y por vendedor (quién la cargó). */
  private async filas(empresaId: string, desde: string, hasta: string) {
    const dia = diaAR(Prisma.raw('v.fecha'));
    const [ubicaciones, vendedores] = await Promise.all([
      this.prisma.$queryRaw<{ clave: string; ventas: bigint; total: string }[]>(Prisma.sql`
        SELECT COALESCE(u.ubicacion, '') AS clave, COUNT(*) AS ventas, SUM(COALESCE(v.total_con_interes, 0)) AS total
        FROM ventas v
        LEFT JOIN LATERAL (
          SELECT m.ubicacion_origen AS ubicacion FROM movimientos_inventario m
          WHERE m.referencia_id = v.id AND m.tipo = 'venta' AND m.signo = -1 AND m.deleted_at IS NULL LIMIT 1
        ) u ON true
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL AND ${dia} BETWEEN ${desde}::date AND ${hasta}::date
        GROUP BY 1`),
      this.prisma.$queryRaw<{ clave: string; nombre: string; ventas: bigint; total: string }[]>(Prisma.sql`
        SELECT v.usuario_id::text AS clave, COALESCE(us.nombre, us.email, 'Sin usuario') AS nombre, COUNT(*) AS ventas, SUM(COALESCE(v.total_con_interes, 0)) AS total
        FROM ventas v
        LEFT JOIN usuarios us ON us.id = v.usuario_id
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL AND ${dia} BETWEEN ${desde}::date AND ${hasta}::date
        GROUP BY 1, 2`),
    ]);
    const a = (f: { clave: string; nombre?: string; ventas: bigint; total: string }, nombre: string): FilaVentas => ({ clave: f.clave, nombre, ventas: Number(f.ventas), total: Number(f.total) });
    return {
      porUbicacion: ubicaciones.map((f) => a(f, f.clave || 'Sin stand asignado')),
      porVendedor: vendedores.map((f) => a(f, f.nombre)),
    };
  }

  async rendimiento(empresaId: string, desde: string, hasta: string) {
    const previo = periodoAnterior(desde, hasta);
    const [actual, anterior] = await Promise.all([this.filas(empresaId, desde, hasta), this.filas(empresaId, previo.desde, previo.hasta)]);
    return {
      periodoAnterior: previo,
      porUbicacion: rendimiento(actual.porUbicacion, anterior.porUbicacion),
      porVendedor: rendimiento(actual.porVendedor, anterior.porVendedor),
    };
  }
}
