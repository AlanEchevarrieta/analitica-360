import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MOVIMIENTOS_REPOSITORY,
  type MovimientoKardexRecord,
  type MovimientoRecord,
  type MovimientosRepository,
} from './movimientos.repository.js';
import type {
  KardexQuery,
  RegistrarAjusteInput,
  RegistrarTrasladoInput,
  RegistrarTrasladoMasivoInput,
} from './inventario.dto.js';
import { signoDeAjuste } from './inventario.util.js';

const MOTIVO_TRASLADO_MENSAJE: Record<'ubicacion_invalida' | 'producto_no_encontrado' | 'stock_insuficiente', string> = {
  producto_no_encontrado: 'Producto no encontrado',
  ubicacion_invalida: 'Elegí origen y destino distintos y válidos',
  stock_insuficiente: 'No hay stock suficiente en el origen para trasladar esa cantidad',
};

@Injectable()
export class MovimientosService {
  constructor(@Inject(MOVIMIENTOS_REPOSITORY) private readonly movimientosRepository: MovimientosRepository) {}

  async registrarAjuste(empresaId: string, usuarioId: string, input: RegistrarAjusteInput): Promise<MovimientoRecord> {
    const resultado = await this.movimientosRepository.crear(empresaId, {
      productoId: input.productoId,
      varianteId: input.varianteId ?? null,
      usuarioId,
      tipo: input.tipo,
      cantidad: input.cantidad,
      signo: signoDeAjuste(input.tipo),
      motivo: input.motivo ?? null,
    });
    if (!resultado.ok) {
      if (resultado.motivo === 'producto_no_encontrado') throw new NotFoundException('Producto no encontrado');
      throw new BadRequestException('La variante no existe o no pertenece a este producto');
    }
    return resultado.movimiento;
  }

  async registrarTraslado(
    empresaId: string,
    usuarioId: string,
    input: RegistrarTrasladoInput,
  ): Promise<[MovimientoRecord, MovimientoRecord]> {
    const resultado = await this.movimientosRepository.registrarTraslado(empresaId, usuarioId, {
      productoId: input.productoId,
      cantidad: input.cantidad,
      origen: input.origen,
      destino: input.destino,
      motivo: input.notas ?? null,
      fecha: input.fecha ? new Date(input.fecha) : new Date(),
    });
    if (!resultado.ok) {
      if (resultado.motivo === 'producto_no_encontrado') throw new NotFoundException('Producto no encontrado');
      throw new BadRequestException(MOTIVO_TRASLADO_MENSAJE[resultado.motivo]);
    }
    return resultado.movimientos;
  }

  /**
   * Puerto de registrarTrasladoMasivo() del legacy: NO es atómico entre
   * líneas - se detiene en el primer error y devuelve lo que ya se
   * completó (cada línea individual sí es atómica, ver registrarTraslado).
   */
  async registrarTrasladoMasivo(
    empresaId: string,
    usuarioId: string,
    input: RegistrarTrasladoMasivoInput,
  ): Promise<{ error: string | null; hechos: { productoId: string; nombre: string; unidades: number }[] }> {
    const hechos: { productoId: string; nombre: string; unidades: number }[] = [];
    for (const linea of input.lineas) {
      if (linea.unidades <= 0) continue;
      const resultado = await this.movimientosRepository.registrarTraslado(empresaId, usuarioId, {
        productoId: linea.productoId,
        cantidad: linea.unidades,
        origen: input.origen,
        destino: input.destino,
        motivo: input.notas ?? null,
        fecha: input.fecha ? new Date(input.fecha) : new Date(),
      });
      if (!resultado.ok) {
        const motivo = MOTIVO_TRASLADO_MENSAJE[resultado.motivo];
        const extra =
          hechos.length > 0
            ? ` Se completaron ${hechos.length} producto${hechos.length === 1 ? '' : 's'} antes del error.`
            : '';
        return { error: `${motivo} (${linea.nombre}).${extra}`, hechos };
      }
      hechos.push(linea);
    }
    return { error: null, hechos };
  }

  async listarKardex(
    empresaId: string,
    productoId: string,
    query: KardexQuery,
  ): Promise<{ filas: MovimientoKardexRecord[]; total: number }> {
    const resultado = await this.movimientosRepository.listarKardex(empresaId, productoId, query);
    if (!resultado) throw new NotFoundException('Producto no encontrado');
    return resultado;
  }
}
