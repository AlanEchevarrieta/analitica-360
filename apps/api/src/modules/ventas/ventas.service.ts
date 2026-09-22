import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  VENTAS_REPOSITORY,
  type FiltrosVentas,
  type ListaVentas,
  type MotivoRechazoVenta,
  type VentaFicha,
  type VentaRecord,
  type VentasRepository,
} from './ventas.repository.js';
import type {
  AnularVentaInput,
  CobrarSaldoVentaInput,
  ConfirmarVentaInput,
  ListarVentasQuery,
} from './ventas.dto.js';

const MOTIVO_MENSAJE: Record<MotivoRechazoVenta, string> = {
  sin_productos: 'Agregá al menos un producto',
  producto_invalido: 'Hay un producto que no existe o no pertenece a esta empresa',
  variante_invalida: 'Hay una variante que no existe o no pertenece a ese producto',
  cliente_invalido: 'Ese cliente no existe o no pertenece a esta empresa',
  ubicacion_invalida: 'Esa ubicación no existe o no pertenece a esta empresa',
  senia_invalida: 'La seña tiene que ser mayor a 0 y menor que el total',
};

@Injectable()
export class VentasService {
  constructor(@Inject(VENTAS_REPOSITORY) private readonly ventasRepository: VentasRepository) {}

  listar(empresaId: string, query: ListarVentasQuery): Promise<ListaVentas> {
    const filtro: FiltrosVentas = {
      pagina: query.pagina,
      pageSize: query.pageSize,
      desde: query.desde,
      hasta: query.hasta,
      forma: query.forma,
      cliente: query.cliente,
      productoId: query.productoId,
      numeroVenta: query.numeroVenta,
      mostrarAnuladas: query.mostrarAnuladas,
    };
    return this.ventasRepository.listar(empresaId, filtro);
  }

  async ficha(empresaId: string, id: string): Promise<VentaFicha> {
    const ficha = await this.ventasRepository.ficha(empresaId, id);
    if (!ficha) throw new NotFoundException('Venta no encontrada');
    return ficha;
  }

  rango(empresaId: string): Promise<{ desde: string; hasta: string } | null> {
    return this.ventasRepository.rango(empresaId);
  }

  async confirmar(empresaId: string, usuarioId: string, input: ConfirmarVentaInput): Promise<VentaRecord> {
    const resultado = await this.ventasRepository.confirmar(empresaId, {
      usuarioId,
      items: input.items,
      formaPago: input.formaPago,
      descuento: input.descuento,
      clienteNombre: input.clienteNombre ?? null,
      clienteId: input.clienteId ?? null,
      cuotas: input.cuotas,
      coeficienteInteres: input.coeficienteInteres,
      ubicacionOrigen: input.ubicacionOrigen ?? null,
      esSenia: input.esSenia,
      montoSenia: input.montoSenia,
    });
    if (!resultado.ok) throw new BadRequestException(MOTIVO_MENSAJE[resultado.motivo]);
    return resultado.venta;
  }

  async anular(empresaId: string, usuarioId: string, id: string, input: AnularVentaInput): Promise<void> {
    const resultado = await this.ventasRepository.anular(empresaId, usuarioId, id, input.motivo);
    if (resultado === 'no_encontrada') throw new NotFoundException('Venta no encontrada');
    if (resultado === 'ya_anulada') throw new BadRequestException('Esa venta ya fue anulada');
  }

  async cobrarSaldo(empresaId: string, id: string, input: CobrarSaldoVentaInput): Promise<VentaRecord> {
    const resultado = await this.ventasRepository.cobrarSaldo(
      empresaId,
      id,
      input.monto,
      input.formaPago,
      new Date(input.fecha),
    );
    if (!resultado.ok) {
      if (resultado.motivo === 'no_encontrada') throw new NotFoundException('Venta no encontrada');
      if (resultado.motivo === 'sin_saldo_pendiente') {
        throw new BadRequestException('Esa venta no tiene saldo para cobrar');
      }
      throw new BadRequestException('El monto tiene que ser mayor a 0 y no superar el saldo pendiente');
    }
    return resultado.venta;
  }
}
