import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CLIENTES_REPOSITORY,
  type ClienteFicha,
  type ClienteRecord,
  type ClientesRepository,
  type CumpleProximoRecord,
  type DestinatarioDifusion,
  type DifusionRecord,
  type SegmentosClientes,
} from './clientes.repository.js';
import type {
  AgregarInteraccionInput,
  GuardarClienteInput,
  GuardarDifusionInput,
} from './clientes.dto.js';

@Injectable()
export class ClientesService {
  constructor(@Inject(CLIENTES_REPOSITORY) private readonly clientesRepository: ClientesRepository) {}

  listar(empresaId: string): Promise<ClienteRecord[]> {
    return this.clientesRepository.listar(empresaId);
  }

  async ficha(empresaId: string, id: string): Promise<ClienteFicha> {
    const ficha = await this.clientesRepository.ficha(empresaId, id);
    if (!ficha) throw new NotFoundException('Cliente no encontrado');
    return ficha;
  }

  crear(empresaId: string, input: GuardarClienteInput): Promise<ClienteRecord> {
    return this.clientesRepository.crear(empresaId, {
      nombre: input.nombre,
      telefono: input.telefono ?? null,
      email: input.email ?? null,
      cumpleanos: input.cumpleanos ?? null,
      notasLibres: input.notasLibres ?? null,
      etiquetas: input.etiquetas,
    });
  }

  async actualizar(empresaId: string, id: string, input: GuardarClienteInput): Promise<ClienteRecord> {
    const cliente = await this.clientesRepository.actualizar(empresaId, id, {
      nombre: input.nombre,
      telefono: input.telefono ?? null,
      email: input.email ?? null,
      cumpleanos: input.cumpleanos ?? null,
      notasLibres: input.notasLibres ?? null,
      etiquetas: input.etiquetas,
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  async agregarInteraccion(
    empresaId: string,
    usuarioId: string,
    clienteId: string,
    input: AgregarInteraccionInput,
  ): Promise<void> {
    const resultado = await this.clientesRepository.agregarInteraccion(empresaId, {
      clienteId,
      usuarioId,
      tipo: input.tipo,
      contenido: input.contenido,
      privado: input.privado,
    });
    if (resultado === 'cliente_invalido') throw new NotFoundException('Cliente no encontrado');
  }

  segmentos(empresaId: string): Promise<SegmentosClientes> {
    return this.clientesRepository.segmentos(empresaId);
  }

  cumpleanosProximos(empresaId: string, horizonteDias: number): Promise<CumpleProximoRecord[]> {
    return this.clientesRepository.cumpleanosProximos(empresaId, horizonteDias);
  }

  cumpleanosMes(empresaId: string): Promise<DestinatarioDifusion[]> {
    return this.clientesRepository.cumpleanosMes(empresaId);
  }

  listarDifusiones(empresaId: string): Promise<DifusionRecord[]> {
    return this.clientesRepository.listarDifusiones(empresaId);
  }

  async guardarDifusion(empresaId: string, usuarioId: string, input: GuardarDifusionInput): Promise<DifusionRecord> {
    if (input.cantidad <= 0) throw new BadRequestException('La difusión no tiene destinatarios');
    return this.clientesRepository.guardarDifusion(empresaId, {
      usuarioId,
      segmento: input.segmento,
      mensaje: input.mensaje,
      cantidad: input.cantidad,
    });
  }
}
