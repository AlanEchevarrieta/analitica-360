import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  VARIANTES_REPOSITORY,
  type VarianteRecord,
  type VariantesRepository,
} from './variantes.repository.js';
import type { GuardarVariantesProductoInput } from './variantes.dto.js';

@Injectable()
export class VariantesService {
  constructor(@Inject(VARIANTES_REPOSITORY) private readonly variantesRepository: VariantesRepository) {}

  async listarPorProducto(empresaId: string, productoId: string): Promise<VarianteRecord[]> {
    const variantes = await this.variantesRepository.listarPorProducto(empresaId, productoId);
    if (!variantes) throw new NotFoundException('Producto no encontrado');
    return variantes;
  }

  async guardar(
    empresaId: string,
    productoId: string,
    input: GuardarVariantesProductoInput,
  ): Promise<VarianteRecord[]> {
    const variantes = await this.variantesRepository.guardarVariantesProducto(
      empresaId,
      productoId,
      input.variantes.map((v) => ({
        id: v.id,
        sku: v.sku ?? null,
        atributos: v.atributos,
        precioVenta: v.precioVenta ?? null,
        costo: v.costo ?? null,
        activo: v.activo,
      })),
    );
    if (!variantes) throw new NotFoundException('Producto no encontrado');
    return variantes;
  }
}
