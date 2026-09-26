import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  RepartoStockError,
  SkuDuplicadoError,
  VARIANTES_REPOSITORY,
  VarianteConStockError,
  type VarianteRecord,
  type VariantesRepository,
} from './variantes.repository.js';
import { SKU_REPOSITORY, type SkuRepository } from './sku.repository.js';
import type { GuardarVariantesProductoInput } from './variantes.dto.js';

const MENSAJE_REPARTO: Record<RepartoStockError['motivo'], (stock: number) => string> = {
  reparto_requerido: (s) => `El producto tiene ${s} unidades sin variante: indicá a qué variante corresponde cada una.`,
  reparto_no_suma: (s) => `El reparto tiene que sumar exactamente ${s} unidades.`,
  reparto_variante_invalida: () => 'El reparto menciona una variante que no está en la lista.',
  stock_negativo: (s) => `El producto tiene stock negativo sin variante (${s}). Ajustalo a 0 desde Inventario antes de agregar variantes.`,
};

@Injectable()
export class VariantesService {
  constructor(
    @Inject(VARIANTES_REPOSITORY) private readonly variantesRepository: VariantesRepository,
    @Inject(SKU_REPOSITORY) private readonly skuRepository: SkuRepository,
  ) {}

  async listarPorProducto(empresaId: string, productoId: string): Promise<VarianteRecord[]> {
    const variantes = await this.variantesRepository.listarPorProducto(empresaId, productoId);
    if (!variantes) throw new NotFoundException('Producto no encontrado');
    return variantes;
  }

  async stockSinVariante(empresaId: string, productoId: string): Promise<{ stock: number }> {
    const stock = await this.variantesRepository.stockSinVariante(empresaId, productoId);
    if (stock == null) throw new NotFoundException('Producto no encontrado');
    return { stock };
  }

  async guardar(empresaId: string, usuarioId: string, productoId: string, input: GuardarVariantesProductoInput): Promise<VarianteRecord[]> {
    const variantes = await this.variantesRepository
      .guardarVariantesProducto(
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
        { usuarioId, reparto: input.repartoSinVariante },
      )
      .catch((error: unknown) => {
        if (error instanceof RepartoStockError) {
          throw new ConflictException({
            message: MENSAJE_REPARTO[error.motivo](error.stockSinVariante),
            codigo: error.motivo,
            stockSinVariante: error.stockSinVariante,
          });
        }
        if (error instanceof SkuDuplicadoError) throw new BadRequestException(`El SKU ${error.sku} ya lo tiene "${error.duplicadoDe}"`);
        if (!(error instanceof VarianteConStockError)) throw error;
        const detalle = error.conStock.map((v) => `${v.etiqueta} (${v.stock})`).join(', ');
        throw new BadRequestException(
          `No se puede desactivar una variante con stock: ${detalle}. Vendé, transferí o ajustá ese stock a 0 primero.`,
        );
      });
    if (!variantes) throw new NotFoundException('Producto no encontrado');
    // Cada variante nueva recibe su SKU automático si no le pusieron uno.
    if (variantes.some((v) => !v.sku)) {
      await this.skuRepository.asignarFaltantes(empresaId, productoId);
      return this.listarPorProducto(empresaId, productoId);
    }
    return variantes;
  }
}
