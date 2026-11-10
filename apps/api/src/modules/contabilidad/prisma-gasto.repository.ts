import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { CategoriaGasto, CrearGastoInput, EditarGastoInput, FrecuenciaGasto, Gasto, GastoRepository, ResultadoAnularGasto, TipoCosto } from './gasto.repository.js';

function toGasto(g: {
  id: string;
  empresaId: string;
  usuarioId: string | null;
  categoria: string;
  descripcion: string;
  monto: { toNumber(): number };
  fecha: Date;
  recurrente: boolean;
  frecuencia: string | null;
  fechaFin?: Date | null;
  tipoCosto: string;
}): Gasto {
  return {
    id: g.id,
    empresaId: g.empresaId,
    usuarioId: g.usuarioId,
    categoria: g.categoria as CategoriaGasto,
    descripcion: g.descripcion,
    monto: g.monto.toNumber(),
    fecha: g.fecha.toISOString().slice(0, 10),
    recurrente: g.recurrente,
    frecuencia: g.frecuencia as FrecuenciaGasto | null,
    fechaFin: g.fechaFin ? g.fechaFin.toISOString().slice(0, 10) : null,
    tipoCosto: g.tipoCosto as TipoCosto,
  };
}

@Injectable()
export class PrismaGastoRepository implements GastoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(empresaId: string, desde: string, hasta: string, categoria?: CategoriaGasto): Promise<Gasto[]> {
    const gastos = await this.prisma.gasto.findMany({
      where: {
        empresaId,
        deletedAt: null,
        fecha: { gte: new Date(desde), lte: new Date(hasta) },
        ...(categoria ? { categoria } : {}),
      },
      orderBy: { fecha: 'desc' },
    });
    return gastos.map(toGasto);
  }

  async crear(input: CrearGastoInput): Promise<Gasto> {
    const gasto = await this.prisma.gasto.create({
      data: {
        empresaId: input.empresaId,
        usuarioId: input.usuarioId,
        categoria: input.categoria,
        descripcion: input.descripcion.trim(),
        monto: input.monto,
        fecha: new Date(input.fecha),
        recurrente: input.recurrente,
        frecuencia: input.recurrente ? input.frecuencia : null,
        tipoCosto: input.tipoCosto,
      },
    });
    return toGasto(gasto);
  }

  async editar(empresaId: string, id: string, input: EditarGastoInput): Promise<Gasto | null> {
    const existente = await this.prisma.gasto.findFirst({ where: { id, empresaId, deletedAt: null } });
    if (!existente) return null;
    const actualizado = await this.prisma.gasto.update({
      where: { id },
      data: {
        ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
        ...(input.descripcion !== undefined ? { descripcion: input.descripcion.trim() } : {}),
        ...(input.monto !== undefined ? { monto: input.monto } : {}),
        ...(input.fecha !== undefined ? { fecha: new Date(input.fecha) } : {}),
      },
    });
    return toGasto(actualizado);
  }

  async dejarDeRepetir(empresaId: string, id: string, fechaFin: string): Promise<Gasto | null> {
    const existente = await this.prisma.gasto.findFirst({ where: { id, empresaId, deletedAt: null } });
    if (!existente) return null;
    const actualizado = await this.prisma.gasto.update({
      where: { id },
      data: { fechaFin: new Date(fechaFin) },
    });
    return toGasto(actualizado);
  }

  async cambiarMontoDesde(empresaId: string, usuarioId: string, id: string, desde: string, fechaFinViejo: string, monto: number): Promise<Gasto | null> {
    return this.prisma.$transaction(async (tx) => {
      const viejo = await tx.gasto.findFirst({ where: { id, empresaId, deletedAt: null } });
      if (!viejo) return null;
      await tx.gasto.update({
        where: { id: viejo.id },
        data: { fechaFin: new Date(fechaFinViejo) },
      });
      const nuevo = await tx.gasto.create({
        data: {
          empresaId,
          usuarioId,
          categoria: viejo.categoria,
          descripcion: viejo.descripcion,
          monto,
          fecha: new Date(desde),
          recurrente: true,
          frecuencia: viejo.frecuencia ?? 'mensual',
          tipoCosto: viejo.tipoCosto,
        },
      });
      return toGasto(nuevo);
    });
  }

  async cambiarTipoCosto(empresaId: string, id: string, tipoCosto: TipoCosto): Promise<boolean> {
    const { count } = await this.prisma.gasto.updateMany({ where: { id, empresaId, deletedAt: null }, data: { tipoCosto } });
    return count > 0;
  }

  async anular(empresaId: string, id: string): Promise<ResultadoAnularGasto> {
    const gasto = await this.prisma.gasto.findFirst({ where: { id, empresaId } });
    if (!gasto) return { ok: false, motivo: 'no_encontrado' };
    const { count } = await this.prisma.gasto.updateMany({
      where: { id, empresaId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) return { ok: false, motivo: 'ya_anulado' };
    return { ok: true };
  }
}
