import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LOTES_REPOSITORY, type LoteRecord, type LotesRepository } from './lotes.repository.js';
import type { CrearLoteInput as CrearLoteDto } from './inventario.dto.js';
import { fechaHoyAR, prefijoLoteMes } from './inventario.util.js';

@Injectable()
export class LotesService {
  constructor(@Inject(LOTES_REPOSITORY) private readonly lotesRepository: LotesRepository) {}

  async listarPorProducto(empresaId: string, productoId: string): Promise<LoteRecord[]> {
    const lotes = await this.lotesRepository.listarPorProducto(empresaId, productoId);
    if (!lotes) throw new NotFoundException('Producto no encontrado');
    return lotes;
  }

  async crear(empresaId: string, usuarioId: string, productoId: string, input: CrearLoteDto): Promise<LoteRecord> {
    const resultado = await this.lotesRepository.crear(empresaId, usuarioId, {
      productoId,
      varianteId: input.varianteId ?? null,
      numeroLote: input.numeroLote,
      fechaVencimiento: input.fechaVencimiento ?? null,
      fechaElaboracion: input.fechaElaboracion ?? null,
      cantidadInicial: input.cantidadInicial,
      proveedorId: input.proveedorId ?? null,
      notas: input.notas ?? null,
      registrarMovimiento: input.registrarMovimiento,
    });
    if (!resultado.ok) {
      if (resultado.motivo === 'producto_no_encontrado') throw new NotFoundException('Producto no encontrado');
      if (resultado.motivo === 'variante_invalida') {
        throw new BadRequestException('La variante no existe o no pertenece a este producto');
      }
      throw new BadRequestException('El proveedor no existe o no pertenece a esta empresa');
    }
    return resultado.lote;
  }

  async sugerenciaNumero(empresaId: string): Promise<string> {
    const prefijo = prefijoLoteMes(fechaHoyAR());
    const siguiente = await this.lotesRepository.sugerenciaNumero(empresaId, prefijo);
    return `${prefijo}-${String(siguiente).padStart(3, '0')}`;
  }

  async disponibles(empresaId: string, productoId: string, varianteId: string | null): Promise<LoteRecord[]> {
    return this.lotesRepository.disponibles(empresaId, productoId, varianteId);
  }
}
