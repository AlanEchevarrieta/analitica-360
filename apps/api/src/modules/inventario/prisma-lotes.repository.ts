import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { CrearLoteInput, LoteRecord, LotesRepository } from './lotes.repository.js';
import { estadoLote } from './inventario.util.js';

type LoteConJoins = {
  id: string;
  empresaId: string;
  productoId: string;
  varianteId: string | null;
  numeroLote: string;
  fechaVencimiento: Date | null;
  fechaElaboracion: Date | null;
  cantidadInicial: Prisma.Decimal;
  proveedorId: string | null;
  notas: string | null;
  activo: boolean;
  producto: { nombre: string };
  variante: { atributos: unknown } | null;
  proveedor: { nombre: string } | null;
};

const includeJoins = {
  producto: { select: { nombre: true } },
  variante: { select: { atributos: true } },
  proveedor: { select: { nombre: true } },
} satisfies Prisma.LoteInclude;

function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function etiquetaVariante(atributos: unknown): string | null {
  if (!atributos || typeof atributos !== 'object') return null;
  const etiqueta = Object.values(atributos as Record<string, string>).filter(Boolean).join('/');
  return etiqueta || null;
}

@Injectable()
export class PrismaLotesRepository implements LotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async stockPorLote(loteIds: string[]): Promise<Map<string, number>> {
    const mapa = new Map<string, number>();
    if (loteIds.length === 0) return mapa;
    const filas = await this.prisma.$queryRaw<{ lote_id: string; stock: string }[]>(Prisma.sql`
      SELECT lote_id, COALESCE(SUM(cantidad * signo), 0) AS stock
      FROM movimientos_inventario
      WHERE lote_id = ANY(${loteIds}::uuid[])
        AND tipo <> 'transferencia'
        AND deleted_at IS NULL
      GROUP BY lote_id
    `);
    for (const f of filas) mapa.set(f.lote_id, Number(f.stock));
    return mapa;
  }

  private async toRecords(filas: LoteConJoins[]): Promise<LoteRecord[]> {
    const stocks = await this.stockPorLote(filas.map((f) => f.id));
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    return filas.map((f) => {
      const cantidadInicial = f.cantidadInicial.toNumber();
      const venc = isoDate(f.fechaVencimiento);
      return {
        id: f.id,
        empresaId: f.empresaId,
        productoId: f.productoId,
        productoNombre: f.producto.nombre,
        varianteId: f.varianteId,
        varianteEtiqueta: etiquetaVariante(f.variante?.atributos),
        numeroLote: f.numeroLote,
        fechaVencimiento: venc,
        fechaElaboracion: isoDate(f.fechaElaboracion),
        cantidadInicial,
        stock: stocks.get(f.id) ?? cantidadInicial,
        proveedorId: f.proveedorId,
        proveedorNombre: f.proveedor?.nombre ?? null,
        notas: f.notas,
        activo: f.activo,
        estado: estadoLote(venc, hoy),
      };
    });
  }

  async listarPorProducto(empresaId: string, productoId: string): Promise<LoteRecord[] | null> {
    const producto = await this.prisma.producto.findFirst({ where: { id: productoId, empresaId } });
    if (!producto) return null;
    const filas = await this.prisma.lote.findMany({
      where: { empresaId, productoId, activo: true },
      include: includeJoins,
      orderBy: [{ fechaVencimiento: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
    return this.toRecords(filas);
  }

  async crear(empresaId: string, usuarioId: string, input: CrearLoteInput): Promise<LoteRecord | null> {
    const producto = await this.prisma.producto.findFirst({ where: { id: input.productoId, empresaId } });
    if (!producto) return null;

    const lote = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.lote.create({
        data: {
          empresaId,
          productoId: input.productoId,
          varianteId: input.varianteId ?? null,
          numeroLote: input.numeroLote,
          fechaVencimiento: input.fechaVencimiento || null,
          fechaElaboracion: input.fechaElaboracion || null,
          cantidadInicial: input.cantidadInicial,
          proveedorId: input.proveedorId || null,
          notas: input.notas?.trim() || null,
          activo: true,
        },
        include: includeJoins,
      });
      if (input.registrarMovimiento && input.cantidadInicial > 0) {
        await tx.movimientoInventario.create({
          data: {
            empresaId,
            productoId: input.productoId,
            varianteId: input.varianteId ?? null,
            loteId: creado.id,
            usuarioId,
            tipo: 'ajuste_positivo',
            cantidad: input.cantidadInicial,
            signo: 1,
            motivo: `Lote ${input.numeroLote}`,
          },
        });
      }
      return creado;
    });
    return (await this.toRecords([lote]))[0];
  }

  async sugerenciaNumero(empresaId: string, prefijo: string): Promise<number> {
    const count = await this.prisma.lote.count({
      where: { empresaId, numeroLote: { startsWith: prefijo } },
    });
    return count + 1;
  }

  async disponibles(empresaId: string, productoId: string, varianteId: string | null): Promise<LoteRecord[]> {
    const todos = await this.listarPorProducto(empresaId, productoId);
    if (!todos) return [];
    return todos
      .filter((l) => (varianteId ? l.varianteId === varianteId : !l.varianteId))
      .filter((l) => l.stock > 0)
      .sort((a, b) => {
        if (!a.fechaVencimiento && !b.fechaVencimiento) return 0;
        if (!a.fechaVencimiento) return 1;
        if (!b.fechaVencimiento) return -1;
        return a.fechaVencimiento.localeCompare(b.fechaVencimiento);
      });
  }
}
