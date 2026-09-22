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

@Injectable()
export class MovimientosService {
  constructor(@Inject(MOVIMIENTOS_REPOSITORY) private readonly movimientosRepository: MovimientosRepository) {}

  async registrarAjuste(empresaId: string, usuarioId: string, input: RegistrarAjusteInput): Promise<MovimientoRecord> {
    const movimiento = await this.movimientosRepository.crear(empresaId, {
      productoId: input.productoId,
      varianteId: input.varianteId ?? null,
      usuarioId,
      tipo: input.tipo,
      cantidad: input.cantidad,
      signo: signoDeAjuste(input.tipo),
      motivo: input.motivo ?? null,
    });
    if (!movimiento) throw new NotFoundException('Producto no encontrado');
    return movimiento;
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
      throw new BadRequestException('Elegí origen y destino distintos y válidos');
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
        const motivo =
          resultado.motivo === 'producto_no_encontrado'
            ? 'Producto no encontrado'
            : 'Elegí origen y destino distintos y válidos';
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
