import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CATEGORIAS_REPOSITORY,
  type CategoriaRecord,
  type CategoriasRepository,
} from './categorias.repository.js';
import type { GuardarCategoriaInput } from './categorias.dto.js';

@Injectable()
export class CategoriasService {
  constructor(@Inject(CATEGORIAS_REPOSITORY) private readonly categoriasRepository: CategoriasRepository) {}

  listar(empresaId: string, soloActivas: boolean): Promise<CategoriaRecord[]> {
    return this.categoriasRepository.listar(empresaId, soloActivas);
  }

  crear(empresaId: string, input: GuardarCategoriaInput): Promise<CategoriaRecord> {
    return this.categoriasRepository.crear({
      empresaId,
      nombre: input.nombre,
      descripcion: input.descripcion?.trim() || null,
      activo: input.activo,
    });
  }

  async actualizar(empresaId: string, id: string, input: GuardarCategoriaInput): Promise<CategoriaRecord> {
    const categoria = await this.categoriasRepository.actualizar(empresaId, id, {
      nombre: input.nombre,
      descripcion: input.descripcion?.trim() || null,
      activo: input.activo,
    });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    return categoria;
  }

  async eliminar(empresaId: string, id: string): Promise<void> {
    const ok = await this.categoriasRepository.eliminar(empresaId, id);
    if (!ok) throw new NotFoundException('Categoría no encontrada');
  }
}
