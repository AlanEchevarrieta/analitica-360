import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  UBICACIONES_REPOSITORY,
  type ResultadoGuardarUbicacion,
  type UbicacionRecord,
  type UbicacionesRepository,
} from './ubicaciones.repository.js';
import type { GuardarUbicacionInput } from './ubicaciones.dto.js';

function desempacar(resultado: ResultadoGuardarUbicacion): UbicacionRecord {
  if (resultado.ok) return resultado.ubicacion;
  if (resultado.motivo === 'no_encontrada') throw new NotFoundException('Ubicación no encontrada');
  throw new ConflictException('Ya existe una ubicación con ese nombre');
}

@Injectable()
export class UbicacionesService {
  constructor(@Inject(UBICACIONES_REPOSITORY) private readonly ubicacionesRepository: UbicacionesRepository) {}

  listar(empresaId: string, soloActivas: boolean): Promise<UbicacionRecord[]> {
    return this.ubicacionesRepository.listar(empresaId, soloActivas);
  }

  async crear(empresaId: string, input: GuardarUbicacionInput): Promise<UbicacionRecord> {
    const resultado = await this.ubicacionesRepository.crear(empresaId, {
      nombre: input.nombre,
      descripcion: input.descripcion?.trim() || null,
      tipo: input.tipo,
      activo: input.activo,
    });
    return desempacar(resultado);
  }

  async actualizar(empresaId: string, id: string, input: GuardarUbicacionInput): Promise<UbicacionRecord> {
    const resultado = await this.ubicacionesRepository.actualizar(empresaId, id, {
      nombre: input.nombre,
      descripcion: input.descripcion?.trim() || null,
      tipo: input.tipo,
      activo: input.activo,
    });
    return desempacar(resultado);
  }

  async eliminar(empresaId: string, id: string): Promise<void> {
    const resultado = await this.ubicacionesRepository.eliminar(empresaId, id);
    if (resultado === 'no_encontrada') throw new NotFoundException('Ubicación no encontrada');
    if (resultado === 'tiene_movimientos') {
      throw new ConflictException('Esta ubicación tiene movimientos registrados. Desactivala en vez de eliminarla.');
    }
  }
}
