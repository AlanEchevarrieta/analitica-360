import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ATRIBUTOS_REPOSITORY,
  type AtributoRecord,
  type AtributosRepository,
} from './atributos.repository.js';
import type { GuardarAtributoInput } from './atributos.dto.js';
import { ATRIBUTOS_DEFAULT } from './variantes.util.js';

@Injectable()
export class AtributosService {
  constructor(@Inject(ATRIBUTOS_REPOSITORY) private readonly atributosRepository: AtributosRepository) {}

  listar(empresaId: string): Promise<AtributoRecord[]> {
    return this.atributosRepository.listar(empresaId);
  }

  crear(empresaId: string, input: GuardarAtributoInput): Promise<AtributoRecord> {
    return this.atributosRepository.crear(empresaId, {
      nombre: input.nombre,
      valores: [...new Set(input.valores)],
      activoVentas: input.activoVentas,
    });
  }

  async actualizar(empresaId: string, id: string, input: GuardarAtributoInput): Promise<AtributoRecord> {
    const atributo = await this.atributosRepository.actualizar(empresaId, id, {
      nombre: input.nombre,
      valores: [...new Set(input.valores)],
      activoVentas: input.activoVentas,
    });
    if (!atributo) throw new NotFoundException('Atributo no encontrado');
    return atributo;
  }

  async eliminar(empresaId: string, id: string): Promise<void> {
    const ok = await this.atributosRepository.eliminar(empresaId, id);
    if (!ok) throw new NotFoundException('Atributo no encontrado');
  }

  /** Siembra el catálogo default (Color/Talle/Material/Tamaño) solo si la empresa no tiene ninguno todavía. */
  async sembrarDefault(empresaId: string): Promise<AtributoRecord[]> {
    const actuales = await this.atributosRepository.listar(empresaId);
    if (actuales.length > 0) return actuales;
    for (const def of ATRIBUTOS_DEFAULT) {
      await this.atributosRepository.crear(empresaId, { nombre: def.nombre, valores: def.valores, activoVentas: true });
    }
    return this.atributosRepository.listar(empresaId);
  }
}
