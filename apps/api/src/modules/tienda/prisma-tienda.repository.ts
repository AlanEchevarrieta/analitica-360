import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { ProductoCatalogo, ProductoVendible, TiendaRepository } from './tienda.repository.js';

function atributosComoTexto(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[k] = String(v ?? '');
  return out;
}

@Injectable()
export class PrismaTiendaRepository implements TiendaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async empresaActiva(empresaId: string): Promise<boolean> {
    const empresa = await this.prisma.empresa.findFirst({
      where: { id: empresaId, activo: true, deletedAt: null },
      select: { id: true },
    });
    return empresa !== null;
  }

  async catalogo(empresaId: string): Promise<ProductoCatalogo[]> {
    // Mismo criterio de stock que el legacy catalogo_tienda: SUM(signo*cantidad)
    // sin contar transferencias (mueven stock entre ubicaciones, no lo cambian).
    const [productos, variantes] = await Promise.all([
      this.prisma.$queryRaw<
        { id: string; nombre: string; categoria: string | null; precio: string; stock: string; vendidos: string }[]
      >(Prisma.sql`
        SELECT
          p.id, p.nombre, p.categoria,
          COALESCE(p.precio_venta, 0) AS precio,
          COALESCE((
            SELECT SUM(m.signo * m.cantidad) FROM movimientos_inventario m
            WHERE m.producto_id = p.id AND m.empresa_id = ${empresaId}::uuid
              AND m.deleted_at IS NULL AND m.variante_id IS NULL AND m.tipo <> 'transferencia'
          ), 0) AS stock,
          COALESCE((
            SELECT SUM(vi.cantidad) FROM ventas_items vi
            JOIN ventas v ON v.id = vi.venta_id
            WHERE vi.producto_id = p.id AND v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL
          ), 0) AS vendidos
        FROM productos p
        WHERE p.empresa_id = ${empresaId}::uuid AND p.activo = TRUE AND p.deleted_at IS NULL
        ORDER BY p.nombre
      `),
      this.prisma.$queryRaw<
        { id: string; producto_id: string; sku: string | null; atributos: unknown; precio: string; stock: string }[]
      >(Prisma.sql`
        SELECT
          pv.id, pv.producto_id, pv.sku, pv.atributos,
          COALESCE(pv.precio_venta, p.precio_venta, 0) AS precio,
          COALESCE((
            SELECT SUM(m.signo * m.cantidad) FROM movimientos_inventario m
            WHERE m.variante_id = pv.id AND m.empresa_id = ${empresaId}::uuid
              AND m.deleted_at IS NULL AND m.tipo <> 'transferencia'
          ), 0) AS stock
        FROM producto_variantes pv
        JOIN productos p ON p.id = pv.producto_id
        WHERE pv.empresa_id = ${empresaId}::uuid AND pv.activo = TRUE AND pv.deleted_at IS NULL
          AND p.activo = TRUE AND p.deleted_at IS NULL
        ORDER BY pv.id
      `),
    ]);

    const variantesPorProducto = new Map<string, ProductoCatalogo['variantes']>();
    for (const v of variantes) {
      const lista = variantesPorProducto.get(v.producto_id) ?? [];
      lista.push({
        id: v.id,
        sku: v.sku,
        atributos: atributosComoTexto(v.atributos),
        precio: Number(v.precio),
        stock: Number(v.stock),
      });
      variantesPorProducto.set(v.producto_id, lista);
    }

    return productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      precio: Number(p.precio),
      stock: Number(p.stock),
      vendidos: Number(p.vendidos),
      variantes: variantesPorProducto.get(p.id) ?? [],
    }));
  }

  async productosVendibles(empresaId: string, productoIds: string[]): Promise<ProductoVendible[]> {
    if (productoIds.length === 0) return [];
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: productoIds }, empresaId, activo: true, deletedAt: null },
      select: {
        id: true,
        precioVenta: true,
        variantes: {
          where: { activo: true, deletedAt: null },
          select: { id: true, precioVenta: true },
        },
      },
    });
    return productos.map((p) => {
      const precio = Number(p.precioVenta ?? 0);
      return {
        id: p.id,
        precio,
        variantes: p.variantes.map((v) => ({ id: v.id, precio: Number(v.precioVenta ?? precio) })),
      };
    });
  }
}
