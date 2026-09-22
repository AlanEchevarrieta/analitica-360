import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PEDIDOS_REPOSITORY,
  type EstadoPedido,
  type ListaPedidos,
  type MotivoRechazoPedido,
  type OrigenPedido,
  type PedidoFicha,
  type PedidosRepository,
  type ResultadoTransicion,
} from './pedidos.repository.js';
import type {
  AsignarPedidoInput,
  CrearPedidoInput,
  GuardarPreparacionItemInput,
  ListarPedidosQuery,
  RegistrarDespachoInput,
} from './pedidos.dto.js';

const MOTIVO_CREAR: Record<MotivoRechazoPedido, string> = {
  sin_items: 'Agregá al menos un producto',
  producto_invalido: 'Hay un producto que no existe o no pertenece a esta empresa',
  variante_invalida: 'Hay una variante que no existe o no pertenece a ese producto',
  cliente_invalido: 'Ese cliente no existe o no pertenece a esta empresa',
};

@Injectable()
export class PedidosService {
  constructor(@Inject(PEDIDOS_REPOSITORY) private readonly pedidosRepository: PedidosRepository) {}

  listar(empresaId: string, query: ListarPedidosQuery): Promise<ListaPedidos> {
    return this.pedidosRepository.listar(empresaId, {
      pagina: query.pagina,
      pageSize: query.pageSize,
      estado: query.estado as EstadoPedido | '',
      origen: query.origen as OrigenPedido | '',
      asignadoA: query.asignadoA ?? null,
    });
  }

  async ficha(empresaId: string, id: string): Promise<PedidoFicha> {
    const ficha = await this.pedidosRepository.ficha(empresaId, id);
    if (!ficha) throw new NotFoundException('Pedido no encontrado');
    return ficha;
  }

  async crear(empresaId: string, input: CrearPedidoInput): Promise<PedidoFicha> {
    const resultado = await this.pedidosRepository.crear(empresaId, {
      clienteId: input.clienteId ?? null,
      clienteNombre: input.clienteNombre ?? null,
      clienteEmail: input.clienteEmail ?? null,
      clienteTelefono: input.clienteTelefono ?? null,
      direccionEnvio: input.direccionEnvio ?? null,
      codigoPostal: input.codigoPostal ?? null,
      localidad: input.localidad ?? null,
      provincia: input.provincia ?? null,
      metodoEnvio: input.metodoEnvio ?? null,
      notas: input.notas ?? null,
      items: input.items,
    });
    if (!resultado.ok) throw new BadRequestException(MOTIVO_CREAR[resultado.motivo]);
    return resultado.pedido;
  }

  async asignar(empresaId: string, id: string, input: AsignarPedidoInput): Promise<void> {
    const resultado = await this.pedidosRepository.asignar(empresaId, id, input.usuarioId);
    if (resultado === 'no_encontrado') throw new NotFoundException('Pedido no encontrado');
    if (resultado === 'usuario_invalido') {
      throw new BadRequestException('Ese usuario no existe o no pertenece a esta empresa');
    }
  }

  async guardarPreparacionItem(
    empresaId: string,
    id: string,
    itemId: string,
    input: GuardarPreparacionItemInput,
  ): Promise<void> {
    const resultado = await this.pedidosRepository.guardarPreparacionItem(
      empresaId,
      id,
      itemId,
      input.cantidadPreparada,
      input.preparado,
    );
    if (resultado === 'no_encontrado') throw new NotFoundException('Pedido o item no encontrado');
  }

  async marcarTodoPreparado(empresaId: string, id: string): Promise<void> {
    const resultado = await this.pedidosRepository.marcarTodoPreparado(empresaId, id);
    if (resultado === 'no_encontrado') throw new NotFoundException('Pedido no encontrado');
  }

  async confirmarListoDespacho(empresaId: string, id: string): Promise<PedidoFicha> {
    const resultado = await this.pedidosRepository.confirmarListoDespacho(empresaId, id);
    if (!resultado.ok) {
      if (resultado.motivo === 'no_encontrado') throw new NotFoundException('Pedido no encontrado');
      throw new BadRequestException('Todavía hay productos sin terminar de preparar');
    }
    return resultado.pedido;
  }

  async registrarDespacho(
    empresaId: string,
    usuarioId: string,
    id: string,
    input: RegistrarDespachoInput,
  ): Promise<PedidoFicha> {
    const resultado = await this.pedidosRepository.registrarDespacho(
      empresaId,
      usuarioId,
      id,
      input.transportista ?? null,
      input.numeroSeguimiento ?? null,
      input.ubicacionOrigen ?? null,
    );
    if (!resultado.ok) {
      if (resultado.motivo === 'no_encontrado') throw new NotFoundException('Pedido no encontrado');
      if (resultado.motivo === 'no_listo_despacho') {
        throw new BadRequestException('El pedido tiene que estar listo para despacho');
      }
      throw new BadRequestException('Esa ubicación no existe o no pertenece a esta empresa');
    }
    return resultado.pedido;
  }

  async marcarConTransportista(empresaId: string, id: string): Promise<void> {
    const resultado = await this.pedidosRepository.marcarConTransportista(empresaId, id);
    this.lanzarSiTransicionInvalida(resultado, 'El pedido tiene que estar despachado');
  }

  async marcarEntregado(empresaId: string, id: string): Promise<void> {
    const resultado = await this.pedidosRepository.marcarEntregado(empresaId, id);
    this.lanzarSiTransicionInvalida(resultado, 'El pedido tiene que estar con el transportista');
  }

  async cancelar(empresaId: string, id: string): Promise<void> {
    const resultado = await this.pedidosRepository.cancelar(empresaId, id);
    this.lanzarSiTransicionInvalida(resultado, 'Solo se puede cancelar un pedido antes de despacharlo');
  }

  private lanzarSiTransicionInvalida(resultado: ResultadoTransicion, mensaje: string): void {
    if (resultado === 'no_encontrado') throw new NotFoundException('Pedido no encontrado');
    if (resultado === 'estado_invalido') throw new BadRequestException(mensaje);
  }

  colaboradoresActivos(empresaId: string): Promise<{ id: string; nombre: string }[]> {
    return this.pedidosRepository.colaboradoresActivos(empresaId);
  }
}
