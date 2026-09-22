import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  UBICACIONES_REPOSITORY,
  type UbicacionRecord,
  type UbicacionesRepository,
} from './ubicaciones.repository.js';
import type { GuardarUbicacionInput } from './ubicaciones.dto.js';

@Injectable()
export class UbicacionesService {
  constructor(@Inject(UBICACIONES_REPOSITORY) private readonly ubicacionesRepository: UbicacionesRepository) {}

  listar(empresaId: string, soloActivas: boolean): Promise<UbicacionRecord[]> {
    return this.ubicacionesRepository.listar(empresaId, soloActivas);
  }

  crear(empresaId: string, input: GuardarUbicacionInput): Promise<UbicacionRecord> {
    return this.ubicacionesRepository.crear(empresaId, {
      nombre: input.nombre,
      descripcion: input.descripcion?.trim() || null,
      tipo: input.tipo,
      activo: input.activo,
    });
  }

  async actualizar(empresaId: string, id: string, input: GuardarUbicacionInput): Promise<UbicacionRecord> {
    const ubicacion = await this.ubicacionesRepository.actualizar(empresaId, id, {
      nombre: input.nombre,
      descripcion: input.descripcion?.trim() || null,
      tipo: input.tipo,
      activo: input.activo,
    });
    if (!ubicacion) throw new NotFoundException('Ubicación no encontrada');
    return ubicacion;
  }

  async eliminar(empresaId: string, id: string): Promise<void> {
    const resultado = await this.ubicacionesRepository.eliminar(empresaId, id);
    if (resultado === 'no_encontrada') throw new NotFoundException('Ubicación no encontrada');
    if (resultado === 'tiene_movimientos') {
      throw new ConflictException('Esta ubicación tiene movimientos registrados. Desactivala en vez de eliminarla.');
    }
  }
}
