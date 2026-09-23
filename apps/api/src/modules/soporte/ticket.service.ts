import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  TICKET_REPOSITORY,
  type BannerTicketHome,
  type TicketFicha,
  type TicketFila,
  type TicketRepository,
  type TicketRespuesta,
} from './ticket.repository.js';
import type { CrearTicketDto } from './ticket.dto.js';

@Injectable()
export class TicketService {
  constructor(@Inject(TICKET_REPOSITORY) private readonly repository: TicketRepository) {}

  listar(empresaId: string): Promise<TicketFila[]> {
    return this.repository.listar(empresaId);
  }

  async ficha(empresaId: string, id: string): Promise<TicketFicha> {
    const ficha = await this.repository.ficha(empresaId, id);
    if (!ficha) throw new NotFoundException('Ticket no encontrado');
    return ficha;
  }

  crear(empresaId: string, usuarioId: string, input: CrearTicketDto): Promise<TicketFila> {
    return this.repository.crear({ empresaId, usuarioId, ...input });
  }

  async responder(empresaId: string, usuarioId: string, ticketId: string, contenido: string): Promise<TicketRespuesta> {
    const resultado = await this.repository.responder(empresaId, usuarioId, ticketId, contenido);
    if (!resultado.ok) {
      if (resultado.motivo === 'no_encontrado') throw new NotFoundException('Ticket no encontrado');
      throw new ConflictException('El ticket está cerrado, no se pueden agregar respuestas');
    }
    return resultado.valor;
  }

  async marcarVisto(empresaId: string, ticketId: string): Promise<void> {
    const resultado = await this.repository.marcarVisto(empresaId, ticketId);
    if (!resultado.ok) throw new NotFoundException('Ticket no encontrado');
  }

  contarNoLeidos(empresaId: string): Promise<number> {
    return this.repository.contarNoLeidos(empresaId);
  }

  marcarTodosVistos(empresaId: string): Promise<void> {
    return this.repository.marcarTodosVistos(empresaId);
  }

  bannerHome(empresaId: string): Promise<BannerTicketHome | null> {
    return this.repository.bannerHome(empresaId);
  }
}
