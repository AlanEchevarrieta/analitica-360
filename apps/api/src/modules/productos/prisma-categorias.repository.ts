import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  ActualizarCategoriaInput,
  CategoriaRecord,
  CategoriasRepository,
  CrearCategoriaInput,
} from './categorias.repository.js';

@Injectable()
export class PrismaCategoriasRepository implements CategoriasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(input: CrearCategoriaInput): Promise<CategoriaRecord> {
    const categoria = await this.prisma.categoria.create({
      data: {
        empresaId: input.empresaId,
        nombre: input.nombre,
        descripcion: input.descripcion,
        activo: input.activo,
      },
    });
    return categoria;
  }

  async actualizar(
    empresaId: string,
    id: string,
    input: ActualizarCategoriaInput,
  ): Promise<CategoriaRecord | null> {
    const { count } = await this.prisma.categoria.updateMany({
      where: { id, empresaId },
      data: { nombre: input.nombre, descripcion: input.descripcion, activo: input.activo },
    });
    if (count === 0) return null;
    return this.buscarPorId(empresaId, id);
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
