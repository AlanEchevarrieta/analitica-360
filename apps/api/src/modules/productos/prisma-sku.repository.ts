import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { CodigoEncontrado, SkuRepository } from './sku.repository.js';
import { generarSku, normalizarSku } from './sku.util.js';

@Injectable()
export class PrismaSkuRepository implements SkuRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async usados(empresaId: string): Promise<Set<string>> {
    const filas = await this.prisma.$queryRaw<{ sku: string }[]>(Prisma.sql`
      SELECT upper(sku) AS sku FROM productos WHERE empresa_id = ${empresaId}::uuid AND sku IS NOT NULL AND deleted_at IS NULL
      UNION
      SELECT upper(sku) FROM producto_variantes WHERE empresa_id = ${empresaId}::uuid AND sku IS NOT NULL AND deleted_at IS NULL
    `);
    return new Set(filas.map((f) => f.sku));
  }

  async asignarFaltantes(empresaId: string, productoId?: string): Promise<number> {
    const [productos, variantes] = await Promise.all([
      this.prisma.producto.findMany({
        where: { empresaId, deletedAt: null, sku: null, usaVariantes: false, ...(productoId ? { id: productoId } : {}) },
        select: { id: true, nombre: true, categoria: true, categoriaRel: { select: { nombre: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.productoVariante.findMany({
        where: { empresaId, deletedAt: null, sku: null, ...(productoId ? { productoId } : {}) },
        select: { id: true, atributos: true, producto: { select: { nombre: true, categoria: true, categoriaRel: { select: { nombre: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    if (productos.length === 0 && variantes.length === 0) return 0;
    const usados = await this.usados(empresaId);
    const updates: Prisma.PrismaPromise<unknown>[] = [];
    for (const p of productos) {
      const sku = generarSku({ categoria: p.categoriaRel?.nombre ?? p.categoria, producto: p.nombre }, usados);
      updates.push(this.prisma.producto.update({ where: { id: p.id }, data: { sku } }));
    }
    for (const v of variantes) {
      const valores = Object.values((v.atributos ?? {}) as Record<string, unknown>).map(String);
      const sku = generarSku({ categoria: v.producto.categoriaRel?.nombre ?? v.producto.categoria, producto: v.producto.nombre, valores }, usados);
      updates.push(this.prisma.productoVariante.update({ where: { id: v.id }, data: { sku } }));
    }
    await this.prisma.$transaction(updates);
    return updates.length;
  }

  async enUso(empresaId: string, sku: string, excluir: { productoId?: string; varianteId?: string }): Promise<string | null> {
    const buscado = normalizarSku(sku);
    if (!buscado) return null;
    const [producto, variante] = await Promise.all([
      this.prisma.producto.findFirst({
        where: { empresaId, deletedAt: null, sku: { equals: buscado, mode: 'insensitive' }, ...(excluir.productoId ? { id: { not: excluir.productoId } } : {}) },
        select: { nombre: true },
      }),
      this.prisma.productoVariante.findFirst({
        where: { empresaId, deletedAt: null, sku: { equals: buscado, mode: 'insensitive' }, ...(excluir.varianteId ? { id: { not: excluir.varianteId } } : {}) },
        select: { atributos: true, producto: { select: { nombre: true } } },
      }),
    ]);
    if (producto) return producto.nombre;
    if (variante) return `${variante.producto.nombre} (${Object.values(variante.atributos as Record<string, string>).join(' / ')})`;
    return null;
  }

  async buscarPorCodigo(empresaId: string, codigo: string): Promise<CodigoEncontrado | null> {
    const c = codigo.trim();
    if (!c) return null;
    const variante = await this.prisma.productoVariante.findFirst({
      where: { empresaId, deletedAt: null, activo: true, sku: { equals: c, mode: 'insensitive' }, producto: { deletedAt: null } },
      select: { id: true, productoId: true },
    });
    if (variante) return { productoId: variante.productoId, varianteId: variante.id };
    const producto = await this.prisma.producto.findFirst({
      where: { empresaId, deletedAt: null, OR: [{ codigoBarra: c }, { sku: { equals: c, mode: 'insensitive' } }] },
      select: { id: true },
    });
    return producto ? { productoId: producto.id, varianteId: null } : null;
  }

  async guardarSkuProducto(empresaId: string, productoId: string, sku: string | null) {
    const producto = await this.prisma.producto.findFirst({ where: { id: productoId, empresaId, deletedAt: null } });
    if (!producto) return 'no_encontrado' as const;
    const nuevo = normalizarSku(sku);
    if (nuevo) {
      const duplicadoDe = await this.enUso(empresaId, nuevo, { productoId });
      if (duplicadoDe) return { duplicadoDe };
    }
    await this.prisma.producto.update({ where: { id: productoId }, data: { sku: nuevo } });
    if (!nuevo) await this.asignarFaltantes(empresaId, productoId);
    return 'ok' as const;
  }
}
