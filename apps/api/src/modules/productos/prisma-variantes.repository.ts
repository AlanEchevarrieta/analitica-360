import { Injectable } from '@nestjs/common';
import type { ProductoVariante } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  GuardarVarianteInput,
  VarianteRecord,
  VariantesRepository,
} from './variantes.repository.js';
import { mismaCombinacion, normalizarAtributos, promedioPonderado } from './variantes.util.js';

@Injectable()
export class PrismaVariantesRepository implements VariantesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(v: ProductoVariante): VarianteRecord {
    return {
      id: v.id,
      productoId: v.productoId,
      empresaId: v.empresaId,
      sku: v.sku,
      atributos: normalizarAtributos(v.atributos as Record<string, unknown>),
      precioVenta: v.precioVenta?.toNumber() ?? null,
      costo: v.costo?.toNumber() ?? null,
      activo: v.activo,
    };
  }

  async listarPorProducto(empresaId: string, productoId: string): Promise<VarianteRecord[] | null> {
    const producto = await this.prisma.producto.findFirst({ where: { id: productoId, empresaId } });
    if (!producto) return null;
    const filas = await this.prisma.productoVariante.findMany({
      where: { empresaId, productoId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return filas.map((v) => this.toRecord(v));
  }

  async guardarVariantesProducto(
    empresaId: string,
    productoId: string,
    variantes: GuardarVarianteInput[],
  ): Promise<VarianteRecord[] | null> {
    return this.prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findFirst({ where: { id: productoId, empresaId } });
      if (!producto) return null;

      const actuales = await tx.productoVariante.findMany({ where: { empresaId, productoId, deletedAt: null } });
      const idsKeep = new Set<string>();

      for (const v of variantes) {
        const atributos = normalizarAtributos(v.atributos);
        const existente =
          (v.id ? actuales.find((f) => f.id === v.id) : undefined) ??
          actuales.find((f) =>
            mismaCombinacion(normalizarAtributos(f.atributos as Record<string, unknown>), atributos),
          );

        if (existente) {
          await tx.productoVariante.update({
            where: { id: existente.id },
            data: {
              sku: v.sku?.trim() || null,
              atributos,
              precioVenta: v.precioVenta,
              costo: v.costo,
              activo: v.activo,
            },
          });
          idsKeep.add(existente.id);
          continue;
        }

        const creada = await tx.productoVariante.create({
          data: {
            productoId,
            empresaId,
            sku: v.sku?.trim() || null,
            atributos,
            precioVenta: v.precioVenta,
            costo: v.costo,
            activo: v.activo,
          },
        });
        idsKeep.add(creada.id);
      }

      // Nunca se borran (deletedAt no se toca) - las que no vinieron en la
      // lista se desactivan, igual que guardarVariantesProducto del legacy.
      const aDesactivar = actuales.filter((a) => !idsKeep.has(a.id)).map((a) => a.id);
      if (aDesactivar.length > 0) {
        await tx.productoVariante.updateMany({ where: { id: { in: aDesactivar } }, data: { activo: false } });
      }

      const activas = await tx.productoVariante.findMany({
        where: { empresaId, productoId, deletedAt: null, activo: true },
      });

      // Regla del schema (ver comentario en el modelo ProductoVariante):
      // costo/precioVenta de Producto = promedio ponderado de las variantes
      // activas. Si no queda ninguna activa, NO se pisan costo/precioVenta
      // (podrían ser el precio base propio del producto, cargado desde
      // ProductosModule) - solo se apaga usaVariantes.
      if (activas.length > 0) {
        const costo = promedioPonderado(
          activas.filter((a) => a.costo != null).map((a) => ({ valor: a.costo!.toNumber(), stock: 0 })),
        );
        const precioVenta = promedioPonderado(
          activas.filter((a) => a.precioVenta != null).map((a) => ({ valor: a.precioVenta!.toNumber(), stock: 0 })),
        );
        await tx.producto.update({ where: { id: productoId }, data: { usaVariantes: true, costo, precioVenta } });
        if (costo != null && precioVenta != null) {
          await tx.precioHistorial.create({ data: { empresaId, productoId, precioVenta, costo } });
        }
      } else {
        await tx.producto.update({ where: { id: productoId }, data: { usaVariantes: false } });
      }

      const filas = await tx.productoVariante.findMany({
        where: { empresaId, productoId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      return filas.map((v) => this.toRecord(v));
    });
  }
}
