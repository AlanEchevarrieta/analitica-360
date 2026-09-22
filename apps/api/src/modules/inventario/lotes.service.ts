import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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
    const lote = await this.lotesRepository.crear(empresaId, usuarioId, {
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
    if (!lote) throw new NotFoundException('Producto no encontrado');
    return lote;
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
