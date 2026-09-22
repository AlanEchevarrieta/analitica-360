import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COMPRAS_REPOSITORY,
  type CompraFicha,
  type CompraRecord,
  type ComprasRepository,
  type ListaCompras,
} from './compras.repository.js';
import type { AnularCompraInput, ConfirmarCompraInput, ListarComprasQuery } from './compras.dto.js';

const MOTIVO_MENSAJE: Record<
  'sin_productos' | 'producto_invalido' | 'variante_invalida' | 'proveedor_invalido' | 'ubicacion_invalida',
  string
> = {
  sin_productos: 'Agregá al menos un producto',
  producto_invalido: 'Hay un producto que no existe o no pertenece a esta empresa',
  variante_invalida: 'Hay una variante que no existe o no pertenece a ese producto',
  proveedor_invalido: 'Ese proveedor no existe o no pertenece a esta empresa',
  ubicacion_invalida: 'Esa ubicación no existe o no pertenece a esta empresa',
};

@Injectable()
export class ComprasService {
  constructor(@Inject(COMPRAS_REPOSITORY) private readonly comprasRepository: ComprasRepository) {}

  listar(empresaId: string, query: ListarComprasQuery): Promise<ListaCompras> {
    return this.comprasRepository.listar(empresaId, query);
  }

  async ficha(empresaId: string, id: string): Promise<CompraFicha> {
    const ficha = await this.comprasRepository.ficha(empresaId, id);
    if (!ficha) throw new NotFoundException('Compra no encontrada');
    return ficha;
  }

  async confirmar(empresaId: string, usuarioId: string, input: ConfirmarCompraInput): Promise<CompraRecord> {
    const resultado = await this.comprasRepository.confirmar(empresaId, {
      usuarioId,
      proveedorId: input.proveedorId ?? null,
      proveedorNombre: input.proveedorNombre ?? null,
      fecha: input.fecha,
      notas: input.notas ?? null,
      ubicacionDestino: input.ubicacionDestino ?? null,
      items: input.items,
      costosAdicionales: input.costosAdicionales
        ? { ...input.costosAdicionales, descripcion: input.costosAdicionales.descripcion ?? null }
        : undefined,
    });
    if (!resultado.ok) throw new BadRequestException(MOTIVO_MENSAJE[resultado.motivo]);
    return resultado.compra;
  }

  async anular(empresaId: string, usuarioId: string, id: string, input: AnularCompraInput): Promise<void> {
    const resultado = await this.comprasRepository.anular(empresaId, usuarioId, id, input.motivo);
    if (resultado === 'no_encontrada') throw new NotFoundException('Compra no encontrada');
    if (resultado === 'ya_anulada') throw new BadRequestException('Esa compra ya fue anulada');
  }
}
