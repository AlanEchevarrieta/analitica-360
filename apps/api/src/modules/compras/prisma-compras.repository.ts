import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Compra } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CompraFicha,
  CompraRecord,
  ComprasRepository,
  ConfirmarCompraInput,
  ListaCompras,
  ResultadoConfirmarCompra,
} from './compras.repository.js';

@Injectable()
export class PrismaComprasRepository implements ComprasRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(c: Compra): CompraRecord {
    return {
      id: c.id,
      empresaId: c.empresaId,
      fecha: c.fecha.toISOString().slice(0, 10),
      proveedorNombre: c.proveedorNombre,
      proveedorId: c.proveedorId,
      ordenCompraId: c.ordenCompraId,
      total: c.total?.toNumber() ?? 0,
      notas: c.notas,
      anulada: c.deletedAt != null,
      costoFlete: c.costoFlete.toNumber(),
      costoImpuestos: c.costoImpuestos.toNumber(),
      costoOtros: c.costoOtros.toNumber(),
      descripcionOtros: c.descripcionOtros,
      totalCostosAdicionales: c.totalCostosAdicionales?.toNumber() ?? 0,
      totalReal: c.totalReal.toNumber(),
      imagenFacturaUrl: c.imagenFacturaUrl,
    };
  }

  async listar(
    empresaId: string,
    filtro: { pagina: number; pageSize: number; proveedor: string; mostrarAnuladas: boolean },
  ): Promise<ListaCompras> {
    const proveedor = filtro.proveedor.trim();
    const where: Prisma.CompraWhereInput = {
      empresaId,
      ...(filtro.mostrarAnuladas ? { deletedAt: { not: null } } : { deletedAt: null }),
      ...(proveedor ? { proveedorNombre: { contains: proveedor, mode: 'insensitive' } } : {}),
    };
    const from = (filtro.pagina - 1) * filtro.pageSize;
    const [filas, total] = await Promise.all([
      this.prisma.compra.findMany({ where, orderBy: { fecha: 'desc' }, skip: from, take: filtro.pageSize }),
      this.prisma.compra.count({ where }),
    ]);
    return { items: filas.map((c) => this.toRecord(c)), total };
  }

  async ficha(empresaId: string, id: string): Promise<CompraFicha | null> {
    const compra = await this.prisma.compra.findFirst({ where: { id, empresaId }, include: { items: true } });
    if (!compra) return null;
    return {
      ...this.toRecord(compra),
      items: compra.items.map((i) => ({
        productoNombre: i.productoNombre,
        cantidad: i.cantidad,
        costoUnitario: i.costoUnitario.toNumber(),
        subtotal: i.subtotal.toNumber(),
      })),
    };
  }

  async confirmar(empresaId: string, input: ConfirmarCompraInput): Promise<ResultadoConfirmarCompra> {
    if (input.items.length === 0) return { ok: false, motivo: 'sin_productos' };

    return this.prisma.$transaction(async (tx) => {
      const productoIds = [...new Set(input.items.map((i) => i.productoId))];
      const productos = await tx.producto.findMany({ where: { id: { in: productoIds }, empresaId } });
      if (productos.length !== productoIds.length) return { ok: false, motivo: 'producto_invalido' };

      const varianteIds = [...new Set(input.items.filter((i) => i.varianteId).map((i) => i.varianteId!))];
      if (varianteIds.length > 0) {
        const variantes = await tx.productoVariante.findMany({ where: { id: { in: varianteIds }, empresaId } });
        if (variantes.length !== varianteIds.length) return { ok: false, motivo: 'variante_invalida' };
        const productoDeVariante = new Map(variantes.map((v) => [v.id, v.productoId]));
        const todasValidas = input.items.every(
          (i) => !i.varianteId || productoDeVariante.get(i.varianteId) === i.productoId,
        );
        if (!todasValidas) return { ok: false, motivo: 'variante_invalida' };
      }

      // Chequeos independientes en paralelo, no en serie.
      const [proveedor, ubicacion] = await Promise.all([
        input.proveedorId ? tx.proveedor.findFirst({ where: { id: input.proveedorId, empresaId } }) : null,
        input.ubicacionDestino ? tx.ubicacion.findFirst({ where: { empresaId, nombre: input.ubicacionDestino } }) : null,
      ]);
      if (input.proveedorId && !proveedor) return { ok: false, motivo: 'proveedor_invalido' };
      if (input.ubicacionDestino && !ubicacion) return { ok: false, motivo: 'ubicacion_invalida' };

      const total = input.items.reduce((acc, i) => acc + i.cantidad * i.costoUnitario, 0);
      const flete = input.costosAdicionales?.flete ?? 0;
      const impuestos = input.costosAdicionales?.impuestos ?? 0;
      const otros = input.costosAdicionales?.otros ?? 0;
      const totalCostosAdicionales = flete + impuestos + otros;

      const compra = await tx.compra.create({
        data: {
          empresaId,
          usuarioId: input.usuarioId,
          proveedorNombre: input.proveedorNombre,
          proveedorId: input.proveedorId ?? null,
          fecha: new Date(input.fecha),
          total,
          costoFlete: flete,
          costoImpuestos: impuestos,
          costoOtros: otros,
          descripcionOtros: input.costosAdicionales?.descripcion ?? null,
          totalCostosAdicionales,
          totalReal: total + totalCostosAdicionales,
          notas: input.notas,
          items: {
            create: input.items.map((i) => ({
              empresaId,
              productoId: i.productoId,
              varianteId: i.varianteId ?? null,
              productoNombre: i.productoNombre,
              cantidad: i.cantidad,
              costoUnitario: i.costoUnitario,
              subtotal: i.cantidad * i.costoUnitario,
            })),
          },
        },
      });

      for (const item of input.items) {
        await tx.movimientoInventario.create({
          data: {
            empresaId,
            productoId: item.productoId,
            varianteId: item.varianteId ?? null,
            loteId: item.loteId ?? null,
            usuarioId: input.usuarioId,
            tipo: 'compra',
            cantidad: item.cantidad,
            signo: 1,
            costoUnitario: item.costoUnitario,
            ubicacionDestino: input.ubicacionDestino ?? null,
            referenciaId: compra.id,
          },
        });
      }

      return { ok: true, compra: this.toRecord(compra) };
    });
  }

  async anular(
    empresaId: string,
    usuarioId: string,
    id: string,
    motivo: string,
  ): Promise<'ok' | 'no_encontrada' | 'ya_anulada'> {
    return this.prisma.$transaction(async (tx) => {
      const compra = await tx.compra.findFirst({ where: { id, empresaId } });
      if (!compra) return 'no_encontrada';

      // updateMany con deletedAt:null en el WHERE "reclama" la anulación de
      // forma atómica - si dos anulaciones concurrentes de la misma compra
      // llegan acá, solo una afecta una fila; la otra ve count=0 y corta
      // antes de revertir movimientos por segunda vez.
      const { count } = await tx.compra.updateMany({
        where: { id, empresaId, deletedAt: null },
        data: {
          deletedAt: new Date(),
          // Compra no tiene columna propia de motivo de anulación en el
          // schema - se agrega al final de notas.
          notas: compra.notas ? `${compra.notas}\n[Anulada] ${motivo}` : `[Anulada] ${motivo}`,
        },
      });
      if (count === 0) return 'ya_anulada';

      // Revierte cada movimiento original (mismo producto/variante/lote/
      // cantidad, signo -1) en vez de recalcular desde CompraItem - CompraItem
      // no guarda loteId, así que el movimiento original es la única fuente
      // confiable de qué lote/ubicación se afectó.
      const movimientosOriginales = await tx.movimientoInventario.findMany({
        where: { empresaId, referenciaId: id, tipo: 'compra', signo: 1, deletedAt: null },
      });
      for (const m of movimientosOriginales) {
        await tx.movimientoInventario.create({
          data: {
            empresaId,
            productoId: m.productoId,
            varianteId: m.varianteId,
            loteId: m.loteId,
            usuarioId,
            tipo: 'compra',
            cantidad: m.cantidad,
            signo: -1,
            costoUnitario: m.costoUnitario,
            ubicacionOrigen: m.ubicacionDestino,
            motivo: `Anulación: ${motivo}`,
            referenciaId: id,
          },
        });
      }
      return 'ok';
    });
  }
}
