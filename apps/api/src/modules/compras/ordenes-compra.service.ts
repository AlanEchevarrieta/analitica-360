import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ORDENES_COMPRA_REPOSITORY,
  type GuardarOrdenCompraInput as GuardarOcRepo,
  type EstadoOc,
  type MotivoRechazoOc,
  type OrdenCompraFicha,
  type OrdenCompraRecord,
  type OrdenesCompraRepository,
  type ResultadoGuardarOc,
} from './ordenes-compra.repository.js';
import type {
  ActualizarEstadoOcInput,
  GuardarOrdenCompraInput,
  ListarOrdenesCompraQuery,
  RegistrarRecepcionOcInput,
} from './ordenes-compra.dto.js';

const MOTIVO_MENSAJE: Record<MotivoRechazoOc, string> = {
  proveedor_invalido: 'Ese proveedor no existe o no pertenece a esta empresa',
  producto_invalido: 'Hay un producto que no existe o no pertenece a esta empresa',
  variante_invalida: 'Hay una variante que no existe o no pertenece a ese producto',
  no_editable: 'La orden ya se recibió (aunque sea en parte) o está cancelada: no se puede editar',
};

function normalizar(input: GuardarOrdenCompraInput): GuardarOcRepo {
  return {
    proveedorId: input.proveedorId ?? null,
    fechaEntregaEstimada: input.fechaEntregaEstimada ?? null,
    notas: input.notas ?? null,
    estado: input.estado,
    items: input.items.map((i) => ({
      productoId: i.productoId,
      varianteId: i.varianteId ?? null,
      cantidadPedida: i.cantidadPedida,
      precioUnitario: i.precioUnitario,
    })),
  };
}

function desempacar(resultado: ResultadoGuardarOc): OrdenCompraFicha {
  if (resultado.ok) return resultado.orden;
  if (resultado.motivo === 'no_encontrada') throw new NotFoundException('Orden de compra no encontrada');
  throw new BadRequestException(MOTIVO_MENSAJE[resultado.motivo]);
}

@Injectable()
export class OrdenesCompraService {
  constructor(@Inject(ORDENES_COMPRA_REPOSITORY) private readonly ordenesCompraRepository: OrdenesCompraRepository) {}

  listar(empresaId: string, query: ListarOrdenesCompraQuery): Promise<OrdenCompraRecord[]> {
    return this.ordenesCompraRepository.listar(empresaId, query);
  }

  async ficha(empresaId: string, id: string): Promise<OrdenCompraFicha> {
    const ficha = await this.ordenesCompraRepository.ficha(empresaId, id);
    if (!ficha) throw new NotFoundException('Orden de compra no encontrada');
    return ficha;
  }

  async crear(empresaId: string, input: GuardarOrdenCompraInput): Promise<OrdenCompraFicha> {
    const resultado = await this.ordenesCompraRepository.crear(empresaId, normalizar(input));
    return desempacar(resultado);
  }

  async actualizar(empresaId: string, id: string, input: GuardarOrdenCompraInput): Promise<OrdenCompraFicha> {
    const resultado = await this.ordenesCompraRepository.actualizar(empresaId, id, normalizar(input));
    return desempacar(resultado);
  }

  async actualizarEstado(empresaId: string, id: string, input: ActualizarEstadoOcInput): Promise<OrdenCompraRecord> {
    // "Recibida" sale de registrar la recepción (que suma el stock), nunca a mano.
    if (input.estado === 'recibida' || input.estado === 'recibida_parcial') throw new BadRequestException('Para marcarla como recibida, registrá lo que llegó');
    const actual = await this.ficha(empresaId, id);
    if (actual.estado === 'recibida') throw new BadRequestException('La orden ya se recibió completa');
    if (actual.estado === 'recibida_parcial' && input.estado !== 'cancelada') throw new BadRequestException('La orden ya se recibió en parte: solo se puede cancelar lo que falta');
    const orden = await this.ordenesCompraRepository.actualizarEstado(empresaId, id, input.estado as EstadoOc);
    if (!orden) throw new NotFoundException('Orden de compra no encontrada');
    return orden;
  }

  async registrarRecepcion(
    empresaId: string,
    usuarioId: string,
    id: string,
    input: RegistrarRecepcionOcInput,
  ): Promise<OrdenCompraFicha> {
    const resultado = await this.ordenesCompraRepository.registrarRecepcion(empresaId, usuarioId, id, input.cantidades, input.ubicacionDestino ?? null);
    if (!resultado.ok) {
      if (resultado.motivo === 'no_encontrada') throw new NotFoundException('Orden de compra no encontrada');
      if (resultado.motivo === 'ubicacion_invalida') throw new BadRequestException('Esa ubicación no existe o no pertenece a esta empresa');
      if (resultado.motivo === 'cancelada') throw new BadRequestException('La orden está cancelada: no se puede recibir mercadería');
      throw new BadRequestException('Indicá al menos una cantidad recibida');
    }
    return resultado.orden;
  }
}
