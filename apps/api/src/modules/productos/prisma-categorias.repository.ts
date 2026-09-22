import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { esViolacionUnica } from '../../common/prisma-errors.util.js';
import type {
  ActualizarCategoriaInput,
  CategoriaRecord,
  CategoriasRepository,
  CrearCategoriaInput,
  ResultadoGuardarCategoria,
} from './categorias.repository.js';

@Injectable()
export class PrismaCategoriasRepository implements CategoriasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(input: CrearCategoriaInput): Promise<ResultadoGuardarCategoria> {
    try {
      const categoria = await this.prisma.categoria.create({
        data: {
          empresaId: input.empresaId,
          nombre: input.nombre,
          descripcion: input.descripcion,
          activo: input.activo,
        },
      });
      return { ok: true, categoria };
    } catch (error) {
      if (esViolacionUnica(error)) return { ok: false, motivo: 'nombre_duplicado' };
      throw error;
    }
  }

  async actualizar(
    empresaId: string,
    id: string,
    input: ActualizarCategoriaInput,
  ): Promise<ResultadoGuardarCategoria> {
    try {
      const { count } = await this.prisma.categoria.updateMany({
        where: { id, empresaId },
        data: { nombre: input.nombre, descripcion: input.descripcion, activo: input.activo },
      });
      if (count === 0) return { ok: false, motivo: 'no_encontrada' };
      const categoria = await this.buscarPorId(empresaId, id);
      return { ok: true, categoria: categoria! };
    } catch (error) {
      if (esViolacionUnica(error)) return { ok: false, motivo: 'nombre_duplicado' };
      throw error;
    }
  }

  async eliminar(empresaId: string, id: string): Promise<boolean> {
    const categoria = await this.prisma.categoria.findFirst({ where: { id, empresaId } });
    if (!categoria) return false;
    await this.prisma.$transaction([
      this.prisma.producto.updateMany({ where: { categoriaId: id, empresaId }, data: { categoriaId: null } }),
      this.prisma.categoria.delete({ where: { id } }),
    ]);
    return true;
  }

  async listar(empresaId: string, soloActivas: boolean): Promise<CategoriaRecord[]> {
    return this.prisma.categoria.findMany({
      where: { empresaId, ...(soloActivas ? { activo: true } : {}) },
      orderBy: { nombre: 'asc' },
    });
  }

  async buscarPorId(empresaId: string, id: string): Promise<CategoriaRecord | null> {
    return this.prisma.categoria.findFirst({ where: { id, empresaId } });
  }
}
