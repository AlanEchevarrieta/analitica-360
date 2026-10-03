import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { GRUPOS_MOVIMIENTO, nombreTipo, rangoDias, sentido, type GrupoMovimiento } from './movimientos-generales.util.js';

export interface FiltrosMovimientos {
  desde: string;
  hasta: string;
  grupo?: GrupoMovimiento;
  productoId?: string;
  ubicacion?: string;
  busqueda?: string;
  pagina: number;
  pageSize: number;
}

export interface FilaMovimiento {
  id: string;
  fecha: string;
  productoId: string;
  producto: string;
  variante: string | null;
  tipo: string;
  tipoNombre: string;
  sentido: 'entra' | 'sale' | 'traslado';
  cantidad: number;
  /** Costo unitario y valor (cantidad × costo): null si el usuario no puede ver costos. */
  costoUnitario: number | null;
  valor: number | null;
  ubicacionOrigen: string | null;
  ubicacionDestino: string | null;
  /** De dónde viene: "Venta V-000643", "Compra a Sergio", etc., y adónde enlazar. */
  origen: { texto: string; ruta: string | null } | null;
  motivo: string | null;
  usuario: string | null;
}

const etiqueta = (atributos: unknown) =>
  Object.values((atributos ?? {}) as Record<string, string>)
    .filter(Boolean)
    .join(' / ') || null;

/**
 * Todos los movimientos de stock de la empresa en una tabla (Inventario →
 * Movimientos), como el kardex pero de todos los productos juntos.
 */
@Injectable()
export class MovimientosGeneralesService {
  constructor(private readonly prisma: PrismaService) {}

  private filtroSql(empresaId: string, f: FiltrosMovimientos) {
    const { inicio, fin } = rangoDias(f.desde, f.hasta);
    const tipos = f.grupo ? [...GRUPOS_MOVIMIENTO[f.grupo]] : null;
    return Prisma.sql`m.empresa_id = ${empresaId}::uuid AND m.deleted_at IS NULL AND m.fecha >= ${inicio} AND m.fecha < ${fin}
      ${tipos ? Prisma.sql`AND m.tipo = ANY(${tipos}::text[])` : Prisma.empty}
      ${f.productoId ? Prisma.sql`AND m.producto_id = ${f.productoId}::uuid` : Prisma.empty}
      ${f.ubicacion ? Prisma.sql`AND (m.ubicacion_origen = ${f.ubicacion} OR m.ubicacion_destino = ${f.ubicacion})` : Prisma.empty}
      ${f.busqueda ? Prisma.sql`AND p.nombre ILIKE ${`%${f.busqueda}%`}` : Prisma.empty}`;
  }

  async listar(empresaId: string, f: FiltrosMovimientos, verCostos: boolean) {
    const where = this.filtroSql(empresaId, f);
    const desde = Prisma.sql`FROM movimientos_inventario m JOIN productos p ON p.id = m.producto_id LEFT JOIN producto_variantes v ON v.id = m.variante_id`;
    const costo = Prisma.sql`COALESCE(m.costo_unitario, v.costo, p.costo, 0)`;

    const [totales, filas] = await Promise.all([
      this.prisma.$queryRaw<{ total: bigint; ent_cant: string | null; ent_valor: string | null; sal_cant: string | null; sal_valor: string | null; traslados: bigint }[]>(Prisma.sql`
        SELECT count(*) AS total,
          SUM(m.cantidad) FILTER (WHERE m.tipo <> 'transferencia' AND m.signo > 0) AS ent_cant,
          SUM(m.cantidad * ${costo}) FILTER (WHERE m.tipo <> 'transferencia' AND m.signo > 0) AS ent_valor,
          SUM(m.cantidad) FILTER (WHERE m.tipo <> 'transferencia' AND m.signo < 0) AS sal_cant,
          SUM(m.cantidad * ${costo}) FILTER (WHERE m.tipo <> 'transferencia' AND m.signo < 0) AS sal_valor,
          count(*) FILTER (WHERE m.tipo = 'transferencia') AS traslados
        ${desde} WHERE ${where}`),
      this.prisma.$queryRaw<
        { id: string; fecha: Date; producto_id: string; producto: string; atributos: unknown; tipo: string; signo: number; cantidad: string; costo: string; ubicacion_origen: string | null; ubicacion_destino: string | null; referencia_id: string | null; motivo: string | null; usuario: string | null }[]
      >(Prisma.sql`
        SELECT m.id, m.fecha, m.producto_id, p.nombre AS producto, v.atributos, m.tipo, m.signo, m.cantidad, ${costo} AS costo,
          m.ubicacion_origen, m.ubicacion_destino, m.referencia_id, m.motivo, u.nombre AS usuario
        ${desde} LEFT JOIN usuarios u ON u.id = m.usuario_id
        WHERE ${where}
        ORDER BY m.fecha DESC, m.id
        LIMIT ${f.pageSize} OFFSET ${(f.pagina - 1) * f.pageSize}`),
    ]);

    const origenes = await this.origenes(empresaId, [...new Set(filas.map((x) => x.referencia_id).filter((r): r is string => Boolean(r)))]);
    const t = totales[0];
    const num = (x: string | null) => (x == null ? 0 : Number(x));
    return {
      total: Number(t.total),
      pagina: f.pagina,
      pageSize: f.pageSize,
      verCostos,
      totales: {
        entradas: { cantidad: num(t.ent_cant), valor: verCostos ? num(t.ent_valor) : null },
        salidas: { cantidad: num(t.sal_cant), valor: verCostos ? num(t.sal_valor) : null },
        traslados: Number(t.traslados),
      },
      items: filas.map<FilaMovimiento>((x) => {
        const cantidad = Number(x.cantidad);
        const costoUnitario = Number(x.costo);
        return {
          id: x.id,
          fecha: x.fecha.toISOString(),
          productoId: x.producto_id,
          producto: x.producto,
          variante: etiqueta(x.atributos),
          tipo: x.tipo,
          tipoNombre: nombreTipo(x.tipo),
          sentido: sentido(x.tipo, x.signo),
          cantidad,
          costoUnitario: verCostos ? costoUnitario : null,
          valor: verCostos ? Math.round(cantidad * costoUnitario * 100) / 100 : null,
          ubicacionOrigen: x.ubicacion_origen,
          ubicacionDestino: x.ubicacion_destino,
          origen: x.referencia_id ? (origenes.get(x.referencia_id) ?? null) : null,
          motivo: x.motivo,
          usuario: x.usuario,
        };
      }),
    };
  }

  /** "Venta V-000643", "Compra a Sergio", "Pedido P-0012", "Orden de producción 3", con su enlace. */
  private async origenes(empresaId: string, ids: string[]) {
    const mapa = new Map<string, { texto: string; ruta: string | null }>();
    if (ids.length === 0) return mapa;
    const [ventas, compras, pedidos, ordenes] = await Promise.all([
      this.prisma.venta.findMany({ where: { empresaId, id: { in: ids } }, select: { id: true, numeroVenta: true } }),
      this.prisma.compra.findMany({ where: { empresaId, id: { in: ids } }, select: { id: true, proveedorNombre: true, proveedor: { select: { nombre: true } } } }),
      this.prisma.pedido.findMany({ where: { empresaId, id: { in: ids } }, select: { id: true, numeroPedido: true } }),
      this.prisma.ordenProduccion.findMany({ where: { empresaId, id: { in: ids } }, select: { id: true, numero: true } }),
    ]);
    for (const v of ventas) mapa.set(v.id, { texto: `Venta ${v.numeroVenta ?? ''}`.trim(), ruta: `/ventas/${v.id}` });
    for (const c of compras) mapa.set(c.id, { texto: `Compra a ${c.proveedor?.nombre ?? c.proveedorNombre ?? 'proveedor'}`, ruta: '/compras' });
    for (const p of pedidos) mapa.set(p.id, { texto: `Pedido ${p.numeroPedido}`, ruta: `/pedidos/${p.id}` });
    for (const o of ordenes) mapa.set(o.id, { texto: `Orden de producción ${o.numero}`, ruta: '/produccion' });
    return mapa;
  }

  /** Ubicaciones que aparecen en los movimientos (para el filtro). */
  async ubicaciones(empresaId: string): Promise<string[]> {
    const filas = await this.prisma.$queryRaw<{ u: string }[]>(Prisma.sql`
      SELECT DISTINCT u FROM (
        SELECT ubicacion_origen AS u FROM movimientos_inventario WHERE empresa_id = ${empresaId}::uuid AND deleted_at IS NULL
        UNION SELECT ubicacion_destino FROM movimientos_inventario WHERE empresa_id = ${empresaId}::uuid AND deleted_at IS NULL
      ) x WHERE u IS NOT NULL AND u <> '' ORDER BY u`);
    return filas.map((f) => f.u);
  }
}
