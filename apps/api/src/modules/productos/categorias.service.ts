import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CATEGORIAS_REPOSITORY,
  type CategoriaRecord,
  type CategoriasRepository,
  type ResultadoGuardarCategoria,
} from './categorias.repository.js';
import type { GuardarCategoriaInput } from './categorias.dto.js';

function desempacar(resultado: ResultadoGuardarCategoria): CategoriaRecord {
  if (resultado.ok) return resultado.categoria;
  if (resultado.motivo === 'no_encontrada') throw new NotFoundException('Categoría no encontrada');
  throw new ConflictException('Ya existe una categoría con ese nombre');
}

@Injectable()
export class CategoriasService {
  constructor(@Inject(CATEGORIAS_REPOSITORY) private readonly categoriasRepository: CategoriasRepository) {}

  listar(empresaId: string, soloActivas: boolean): Promise<CategoriaRecord[]> {
    return this.categoriasRepository.listar(empresaId, soloActivas);
  }

  async crear(empresaId: string, input: GuardarCategoriaInput): Promise<CategoriaRecord> {
    const resultado = await this.categoriasRepository.crear({
      empresaId,
      nombre: input.nombre,
      descripcion: input.descripcion?.trim() || null,
      activo: input.activo,
    });
    return desempacar(resultado);
  }

  async actualizar(empresaId: string, id: string, input: GuardarCategoriaInput): Promise<CategoriaRecord> {
    const resultado = await this.categoriasRepository.actualizar(empresaId, id, {
      nombre: input.nombre,
      descripcion: input.descripcion?.trim() || null,
      activo: input.activo,
    });
    return desempacar(resultado);
  }

  async eliminar(empresaId: string, id: string): Promise<void> {
    const ok = await this.categoriasRepository.eliminar(empresaId, id);
    if (!ok) throw new NotFoundException('Categoría no encontrada');
  }
}
