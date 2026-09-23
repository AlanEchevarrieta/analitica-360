import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { CategoriaGasto, CrearGastoInput, FrecuenciaGasto, Gasto, GastoRepository, ResultadoAnularGasto } from './gasto.repository.js';

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
      },
    });
    return toGasto(gasto);
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
