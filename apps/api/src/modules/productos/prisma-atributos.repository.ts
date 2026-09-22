import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  AtributoRecord,
  AtributosRepository,
  GuardarAtributoInput,
} from './atributos.repository.js';

@Injectable()
export class PrismaAtributosRepository implements AtributosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(empresaId: string): Promise<AtributoRecord[]> {
    return this.prisma.atributo.findMany({ where: { empresaId }, orderBy: { createdAt: 'asc' } });
  }

  async crear(empresaId: string, input: GuardarAtributoInput): Promise<AtributoRecord> {
    return this.prisma.atributo.create({
      data: { empresaId, nombre: input.nombre, valores: input.valores, activoVentas: input.activoVentas },
    });
  }

  async actualizar(empresaId: string, id: string, input: GuardarAtributoInput): Promise<AtributoRecord | null> {
    const { count } = await this.prisma.atributo.updateMany({
      where: { id, empresaId },
      data: { nombre: input.nombre, valores: input.valores, activoVentas: input.activoVentas },
    });
    if (count === 0) return null;
    return this.prisma.atributo.findFirst({ where: { id, empresaId } });
  }

  async eliminar(empresaId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.atributo.deleteMany({ where: { id, empresaId } });
    return count > 0;
  }
}
