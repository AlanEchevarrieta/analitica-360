import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaLocalAR } from '../analytics/analytics.util.js';
import { diaAR } from '../analytics/fecha-sql.js';
import { kardexValorizado, TIPOS_PERDIDA, type FilaKardex, type KardexValorizado } from './kardex.util.js';

export interface FilaKardexRespuesta extends FilaKardex {
  varianteEtiqueta: string | null;
  /** Venta (número) o compra (proveedor) que originó el movimiento, si corresponde. */
  comprobante: string | null;
}

export interface KardexRespuesta extends Omit<KardexValorizado, 'filas'> {
  producto: { id: string; nombre: string; costo: number | null; sku: string | null };
  variantes: { id: string; etiqueta: string }[];
  filas: FilaKardexRespuesta[];
}

export interface PerdidasRespuesta {
  total: number;
  porTipo: { tipo: string; cantidad: number; valor: number }[];
  porProducto: { productoId: string; nombre: string; cantidad: number; valor: number }[];
}

const etiqueta = (atributos: unknown) =>
  Object.values((atributos ?? {}) as Record<string, string>)
    .filter(Boolean)
    .join(' / ');

@Injectable()
export class KardexService {
  constructor(private readonly prisma: PrismaService) {}

  async kardex(empresaId: string, productoId: string, desde: string, hasta: string, varianteId: string | null): Promise<KardexRespuesta> {
    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, empresaId },
      select: { id: true, nombre: true, costo: true, sku: true, variantes: { where: { deletedAt: null }, select: { id: true, atributos: true, costo: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    const variante = varianteId ? producto.variantes.find((v) => v.id === varianteId) : null;
    if (varianteId && !variante) throw new NotFoundException('Variante no encontrada');

    const movimientos = await this.prisma.movimientoInventario.findMany({
      where: { empresaId, productoId, deletedAt: null, ...(varianteId ? { varianteId } : {}) },
      select: { id: true, fecha: true, tipo: true, cantidad: true, signo: true, costoUnitario: true, varianteId: true, motivo: true, referenciaId: true, usuario: { select: { nombre: true } } },
    });
    const costoRespaldo = (variante?.costo ?? producto.costo)?.toNumber() ?? null;
    const k = kardexValorizado(
      movimientos.map((m) => ({
        id: m.id,
        fecha: fechaLocalAR(m.fecha),
        fechaHora: m.fecha,
        tipo: m.tipo,
        cantidad: m.cantidad.toNumber(),
        signo: m.signo as 1 | -1,
        costoUnitario: m.costoUnitario?.toNumber() ?? null,
        varianteId: m.varianteId,
        motivo: m.motivo,
        referenciaId: m.referenciaId,
        usuario: m.usuario?.nombre ?? null,
      })),
      desde,
      hasta,
      costoRespaldo,
    );

    // Número de comprobante de ventas y compras (solo de las filas del período).
    const refs = [...new Set(k.filas.map((f) => f.referenciaId).filter((r): r is string => Boolean(r)))];
    const [ventas, compras] = refs.length
      ? await Promise.all([
          this.prisma.venta.findMany({ where: { empresaId, id: { in: refs } }, select: { id: true, numeroVenta: true } }),
          this.prisma.compra.findMany({ where: { empresaId, id: { in: refs } }, select: { id: true, proveedorNombre: true, proveedor: { select: { nombre: true } } } }),
        ])
      : [[], []];
    const comprobantes = new Map<string, string | null>([...ventas.map((v) => [v.id, v.numeroVenta] as const), ...compras.map((c) => [c.id, `Compra a ${c.proveedor?.nombre ?? c.proveedorNombre ?? 'proveedor'}`] as const)]);
    const etiquetas = new Map(producto.variantes.map((v) => [v.id, etiqueta(v.atributos)]));

    return {
      ...k,
      producto: { id: producto.id, nombre: producto.nombre, costo: producto.costo?.toNumber() ?? null, sku: producto.sku },
      variantes: producto.variantes.map((v) => ({ id: v.id, etiqueta: etiquetas.get(v.id)! })),
      filas: k.filas.map((f) => ({
        ...f,
        varianteEtiqueta: f.varianteId ? (etiquetas.get(f.varianteId) ?? null) : null,
        comprobante: f.referenciaId ? (comprobantes.get(f.referenciaId) ?? null) : null,
      })),
    };
  }

  /** Mermas, roturas, pérdidas y consumo interno del período, valuados al costo del momento. */
  async perdidas(empresaId: string, desde: string, hasta: string): Promise<PerdidasRespuesta> {
    const filas = await this.prisma.$queryRaw<{ producto_id: string; nombre: string; tipo: string; cantidad: string; valor: string }[]>(Prisma.sql`
      SELECT m.producto_id, p.nombre, m.tipo, SUM(m.cantidad) AS cantidad,
             SUM(m.cantidad * COALESCE(m.costo_unitario, v.costo, p.costo, 0)) AS valor
      FROM movimientos_inventario m
      JOIN productos p ON p.id = m.producto_id AND p.empresa_id = ${empresaId}::uuid
      LEFT JOIN producto_variantes v ON v.id = m.variante_id
      WHERE m.empresa_id = ${empresaId}::uuid AND m.deleted_at IS NULL AND m.signo = -1
        AND m.tipo IN (${Prisma.join([...TIPOS_PERDIDA])})
        AND ${diaAR(Prisma.raw('m.fecha'))} BETWEEN ${desde}::date AND ${hasta}::date
      GROUP BY m.producto_id, p.nombre, m.tipo
    `);
    const porTipo = new Map<string, { cantidad: number; valor: number }>();
    const porProducto = new Map<string, { productoId: string; nombre: string; cantidad: number; valor: number }>();
    for (const f of filas) {
      const cantidad = Number(f.cantidad);
      const valor = Number(f.valor);
      const t = porTipo.get(f.tipo) ?? { cantidad: 0, valor: 0 };
      porTipo.set(f.tipo, { cantidad: t.cantidad + cantidad, valor: t.valor + valor });
      const p = porProducto.get(f.producto_id) ?? { productoId: f.producto_id, nombre: f.nombre, cantidad: 0, valor: 0 };
      porProducto.set(f.producto_id, { ...p, cantidad: p.cantidad + cantidad, valor: p.valor + valor });
    }
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return {
      total: r2([...porTipo.values()].reduce((a, t) => a + t.valor, 0)),
      porTipo: [...porTipo].map(([tipo, t]) => ({ tipo, cantidad: t.cantidad, valor: r2(t.valor) })).sort((a, b) => b.valor - a.valor),
      porProducto: [...porProducto.values()].map((p) => ({ ...p, valor: r2(p.valor) })).sort((a, b) => b.valor - a.valor),
    };
  }
}
