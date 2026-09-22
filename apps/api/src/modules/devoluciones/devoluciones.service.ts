import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEVOLUCIONES_REPOSITORY,
  type DevolucionFicha,
  type DevolucionRecord,
  type DevolucionesRepository,
  type MotivoRechazoDevolucion,
  type VentaBusquedaHit,
} from './devoluciones.repository.js';
import type { BuscarVentasQuery, ListarDevolucionesQuery, RegistrarDevolucionInput } from './devoluciones.dto.js';

const MOTIVO_MENSAJE: Record<MotivoRechazoDevolucion, string> = {
  sin_items: 'Agregá al menos un producto',
  item_invalido: 'Revisá cantidades y productos',
  venta_invalida: 'Esa venta no existe o no pertenece a esta empresa',
};

@Injectable()
export class DevolucionesService {
  constructor(@Inject(DEVOLUCIONES_REPOSITORY) private readonly devolucionesRepository: DevolucionesRepository) {}

  listar(empresaId: string, query: ListarDevolucionesQuery): Promise<DevolucionRecord[]> {
    return this.devolucionesRepository.listar(empresaId, query);
  }

  async ficha(empresaId: string, id: string): Promise<DevolucionFicha> {
    const ficha = await this.devolucionesRepository.ficha(empresaId, id);
    if (!ficha) throw new NotFoundException('Devolución no encontrada');
    return ficha;
  }

  async registrar(empresaId: string, usuarioId: string, input: RegistrarDevolucionInput): Promise<DevolucionFicha> {
    const resultado = await this.devolucionesRepository.registrar(empresaId, {
      usuarioId,
      tipo: input.tipo,
      ventaId: input.ventaId ?? null,
      motivo: input.motivo ?? null,
      notas: input.notas ?? null,
      items: input.items,
    });
    if (!resultado.ok) throw new BadRequestException(MOTIVO_MENSAJE[resultado.motivo]);
    return resultado.devolucion;
  }

  async procesar(empresaId: string, id: string): Promise<void> {
    const resultado = await this.devolucionesRepository.procesar(empresaId, id);
    if (resultado === 'no_encontrada') throw new NotFoundException('Devolución no encontrada');
    if (resultado === 'no_pendiente') throw new BadRequestException('Solo se puede procesar si está pendiente');
  }

  async cancelar(empresaId: string, usuarioId: string, id: string): Promise<void> {
    const resultado = await this.devolucionesRepository.cancelar(empresaId, usuarioId, id);
    if (resultado === 'no_encontrada') throw new NotFoundException('Devolución no encontrada');
    if (resultado === 'no_pendiente') throw new BadRequestException('Solo se puede cancelar si está pendiente');
  }

  buscarVentas(empresaId: string, query: BuscarVentasQuery): Promise<VentaBusquedaHit[]> {
    return this.devolucionesRepository.buscarVentas(empresaId, query.q);
  }
}
