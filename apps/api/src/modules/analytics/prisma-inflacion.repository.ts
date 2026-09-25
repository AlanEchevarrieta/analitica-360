import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { InflacionRepository } from './inflacion.repository.js';
import { indiceEncadenado, mesAnteriorKey } from './inflacion.util.js';
import { fechaLocalAR } from './analytics.util.js';

@Injectable()
export class PrismaInflacionRepository implements InflacionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async preciosPromedioHistorial(empresaId: string, desde: string, hasta: string): Promise<Map<string, number>> {
    const desdeExt = new Date(`${mesAnteriorKey(desde.slice(0, 7))}-01`);
    const hastaDate = new Date(`${hasta}T23:59:59.999`);
    const filas = await this.prisma.precioHistorial.findMany({
      where: { empresaId, fechaDesde: { gte: desdeExt, lte: hastaDate } },
      select: { productoId: true, variante: true, precioVenta: true, fechaDesde: true },
    });
    return indiceEncadenado(
      filas.map((f) => ({
        mes: f.fechaDesde.toISOString().slice(0, 7),
        productoId: `${f.productoId}:${f.variante ?? ''}`,
        precio: f.precioVenta.toNumber(),
        cantidad: 1,
      })),
    );
  }

  async preciosPromedioVentasItems(empresaId: string, desde: string, hasta: string): Promise<Map<string, number>> {
    const desdeExt = new Date(`${mesAnteriorKey(desde.slice(0, 7))}-01T00:00:00.000-03:00`);
    const hastaDate = new Date(`${hasta}T23:59:59.999-03:00`);
    const ventas = await this.prisma.venta.findMany({
      where: { empresaId, deletedAt: null, fecha: { gte: desdeExt, lte: hastaDate } },
      select: { id: true, fecha: true },
    });
    const mesPorVenta = new Map(ventas.map((v) => [v.id, fechaLocalAR(v.fecha).slice(0, 7)]));
    const ids = [...mesPorVenta.keys()];
    if (ids.length === 0) return new Map();

    const slices: string[][] = [];
    for (let i = 0; i < ids.length; i += 200) slices.push(ids.slice(i, i + 200));
    const paginas = await Promise.all(
      slices.map((slice) =>
        this.prisma.ventaItem.findMany({
          where: { empresaId, ventaId: { in: slice } },
          select: { ventaId: true, productoId: true, varianteId: true, cantidad: true, precioUnitario: true },
        }),
      ),
    );
    return indiceEncadenado(
      paginas.flat().map((r) => ({
        mes: mesPorVenta.get(r.ventaId) ?? '',
        productoId: `${r.productoId}:${r.varianteId ?? ''}`,
        precio: r.precioUnitario.toNumber(),
        cantidad: r.cantidad,
      })),
    );
  }
}
