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
    // Empresa activa y con la tienda online activada en Configuración.
    const empresa = await this.prisma.empresa.findFirst({
      where: { id: empresaId, activo: true, deletedAt: null, tienda: { activa: true } },
      select: { id: true },
    });
    return empresa !== null;
  }

  async pedidoMinimo(empresaId: string): Promise<number | null> {
    const t = await this.prisma.tiendaConfig.findUnique({ where: { empresaId }, select: { pedidoMinimo: true } });
    return t?.pedidoMinimo == null ? null : Number(t.pedidoMinimo);
  }

  async catalogo(empresaId: string): Promise<ProductoCatalogo[]> {
    // Mismo criterio de stock que el legacy catalogo_tienda: SUM(signo*cantidad)
    // sin contar transferencias (mueven stock entre ubicaciones, no lo cambian).
    const [productos, variantes] = await Promise.all([
      this.prisma.$queryRaw<
        { id: string; nombre: string; categoria: string | null; categoria_id: string | null; precio: string; stock: string; vendidos: string }[]
      >(Prisma.sql`
        SELECT
          -- La categoría real (categorias) manda; el texto legacy queda de respaldo.
          p.id, p.nombre, COALESCE(cat.nombre, p.categoria) AS categoria, p.categoria_id,
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
        LEFT JOIN categorias cat ON cat.id = p.categoria_id
        WHERE p.empresa_id = ${empresaId}::uuid AND p.activo = TRUE AND p.deleted_at IS NULL
          AND p.es_insumo = FALSE AND p.en_tienda = TRUE
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
          AND p.activo = TRUE AND p.deleted_at IS NULL AND p.es_insumo = FALSE AND p.en_tienda = TRUE
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

    const ids = productos.map((p) => p.id);
    const [imagenes, kits] = await Promise.all([
      ids.length ? this.prisma.productoImagen.findMany({ where: { empresaId, productoId: { in: ids } }, select: { productoId: true, url: true, urlMiniatura: true }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] }) : [],
      this.disponibilidadKits(empresaId, ids),
    ]);
    const fotos = new Map<string, string[]>();
    const chicas = new Map<string, string[]>();
    for (const i of imagenes) {
      fotos.set(i.productoId, [...(fotos.get(i.productoId) ?? []), i.url]);
      chicas.set(i.productoId, [...(chicas.get(i.productoId) ?? []), i.urlMiniatura ?? i.url]);
    }

    return productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      categoriaId: p.categoria_id,
      precio: Number(p.precio),
      // Kit que se arma al vender: su stock es cuántos se pueden armar.
      stock: kits.get(p.id) ?? Number(p.stock),
      vendidos: Number(p.vendidos),
      imagenes: fotos.get(p.id) ?? [],
      miniaturas: chicas.get(p.id) ?? [],
      variantes: variantesPorProducto.get(p.id) ?? [],
    }));
  }

  private async disponibilidadKits(empresaId: string, ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const recetas = await this.prisma.receta.findMany({ where: { empresaId, deletedAt: null, armarAlVender: true, varianteId: null, productoId: { in: ids } }, include: { items: true } });
    if (!recetas.length) return new Map();
    const filas = await this.prisma.movimientoInventario.groupBy({
      by: ['productoId', 'varianteId', 'signo'],
      where: { empresaId, deletedAt: null, productoId: { in: [...new Set(recetas.flatMap((r) => r.items.map((i) => i.insumoId)))] }, tipo: { not: 'transferencia' } },
      _sum: { cantidad: true },
    });
    const stock = new Map<string, number>();
    for (const f of filas) {
      const k = `${f.productoId}:${f.varianteId ?? ''}`;
      stock.set(k, (stock.get(k) ?? 0) + (f._sum.cantidad?.toNumber() ?? 0) * f.signo);
    }
    return new Map(recetas.map((r) => [r.productoId, Math.max(0, Math.min(...r.items.map((i) => Math.floor((stock.get(`${i.insumoId}:${i.insumoVarianteId ?? ''}`) ?? 0) / i.cantidad.toNumber()))))]));
  }

  async productosVendibles(empresaId: string, productoIds: string[]): Promise<ProductoVendible[]> {
    if (productoIds.length === 0) return [];
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: productoIds }, empresaId, activo: true, deletedAt: null, esInsumo: false, enTienda: true },
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
