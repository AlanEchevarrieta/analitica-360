import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    return this.prisma.$transaction(async (tx) => {
      const anterior = await tx.atributo.findFirst({ where: { id, empresaId } });
      if (!anterior) return null;
      const actualizado = await tx.atributo.update({
        where: { id },
        data: { nombre: input.nombre, valores: input.valores, activoVentas: input.activoVentas },
      });
      // Las variantes guardan el atributo por nombre dentro de su JSON
      // ({ "Color": "Negro" }): al renombrarlo se renombra esa clave.
      if (anterior.nombre !== input.nombre) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE producto_variantes
          SET atributos = (atributos - ${anterior.nombre}) || jsonb_build_object(${input.nombre}::text, atributos -> ${anterior.nombre})
          WHERE empresa_id = ${empresaId}::uuid AND atributos ? ${anterior.nombre}
        `);
      }
      return actualizado;
    });
  }

  async eliminar(empresaId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.atributo.deleteMany({ where: { id, empresaId } });
    return count > 0;
  }
}
