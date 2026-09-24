import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  BannerTicketHome,
  CategoriaTicket,
  CrearTicketInput,
  EstadoTicket,
  PrioridadTicket,
  ResultadoTicket,
  TicketFicha,
  TicketFila,
  TicketFilaAdmin,
  TicketRepository,
  TicketRespuesta,
} from './ticket.repository.js';
import { formatoNumeroTicket, tieneRespuestaAdminNoLeida } from './ticket.util.js';

function toFila(t: { id: string; numeroTicket: string | null; asunto: string; categoria: string; prioridad: string; estado: string; createdAt: Date }): TicketFila {
  return {
    id: t.id,
    numeroTicket: t.numeroTicket,
    asunto: t.asunto,
    categoria: t.categoria as CategoriaTicket,
    prioridad: t.prioridad as PrioridadTicket,
    estado: t.estado as EstadoTicket,
    createdAt: t.createdAt.toISOString(),
  };
}

function toRespuesta(r: { id: string; ticketId: string; autorId: string | null; esAdmin: boolean; contenido: string; createdAt: Date }): TicketRespuesta {
  return { id: r.id, ticketId: r.ticketId, autorId: r.autorId, esAdmin: r.esAdmin, contenido: r.contenido, createdAt: r.createdAt.toISOString() };
}

@Injectable()
export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(empresaId: string): Promise<TicketFila[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: { empresaId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, numeroTicket: true, asunto: true, categoria: true, prioridad: true, estado: true, createdAt: true },
    });
    return tickets.map(toFila);
  }

  async ficha(empresaId: string, id: string): Promise<TicketFicha | null> {
    return this.fichaWhere({ id, empresaId, deletedAt: null });
  }

  /** Puerto del bypass de empresa en ficha_ticket() cuando es_admin_app() - el caller ya verificó @RequireAdminApp(). */
  async fichaAdmin(id: string): Promise<TicketFicha | null> {
    return this.fichaWhere({ id, deletedAt: null });
  }

  private async fichaWhere(where: { id: string; empresaId?: string; deletedAt: null }): Promise<TicketFicha | null> {
    const t = await this.prisma.ticket.findFirst({
      where,
      include: {
        empresa: { select: { nombre: true } },
        usuario: { select: { nombre: true, email: true } },
        respuestas: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!t) return null;
    return {
      ...toFila(t),
      empresaId: t.empresaId,
      usuarioId: t.usuarioId,
      descripcion: t.descripcion,
      vistoClienteAt: t.vistoClienteAt?.toISOString() ?? null,
      updatedAt: t.updatedAt.toISOString(),
      empresaNombre: t.empresa.nombre,
      usuarioNombre: t.usuario?.nombre ?? null,
      usuarioEmail: t.usuario?.email ?? null,
      respuestas: t.respuestas.map(toRespuesta),
    };
  }

  async crear(input: CrearTicketInput): Promise<TicketFila> {
    return this.prisma.$transaction(async (tx) => {
      const num = await tx.ticketNumeracion.upsert({
        where: { id: 1 },
        create: { id: 1, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      });
      const ticket = await tx.ticket.create({
        data: {
          empresaId: input.empresaId,
          usuarioId: input.usuarioId,
          numeroTicket: formatoNumeroTicket(num.ultimo),
          asunto: input.asunto,
          descripcion: input.descripcion,
          categoria: input.categoria,
          prioridad: input.prioridad,
        },
      });
      return toFila(ticket);
    });
  }

  async responder(empresaId: string, usuarioId: string, ticketId: string, contenido: string): Promise<ResultadoTicket<TicketRespuesta>> {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, empresaId, deletedAt: null }, select: { estado: true } });
    if (!ticket) return { ok: false, motivo: 'no_encontrado' };
    if (ticket.estado === 'cerrado') return { ok: false, motivo: 'ticket_cerrado' };
    const respuesta = await this.prisma.ticketRespuesta.create({
      data: { ticketId, autorId: usuarioId, esAdmin: false, contenido },
    });
    return { ok: true, valor: toRespuesta(respuesta) };
  }

  async marcarVisto(empresaId: string, ticketId: string): Promise<ResultadoTicket<true>> {
    const { count } = await this.prisma.ticket.updateMany({
      where: { id: ticketId, empresaId, deletedAt: null },
      data: { vistoClienteAt: new Date() },
    });
    if (count === 0) return { ok: false, motivo: 'no_encontrado' };
    return { ok: true, valor: true };
  }

  private async ticketsParaNoLeidos(empresaId: string) {
    return this.prisma.ticket.findMany({
      where: { empresaId, deletedAt: null },
      take: 200,
      select: {
        id: true,
        numeroTicket: true,
        estado: true,
        vistoClienteAt: true,
        createdAt: true,
        respuestas: { select: { esAdmin: true, createdAt: true } },
      },
    });
  }

  async contarNoLeidos(empresaId: string): Promise<number> {
    const tickets = await this.ticketsParaNoLeidos(empresaId);
    return tickets.filter((t) => tieneRespuestaAdminNoLeida(t.vistoClienteAt, t.respuestas)).length;
  }

  async marcarTodosVistos(empresaId: string): Promise<void> {
    const tickets = await this.ticketsParaNoLeidos(empresaId);
    const ids = tickets.filter((t) => tieneRespuestaAdminNoLeida(t.vistoClienteAt, t.respuestas)).map((t) => t.id);
    if (ids.length === 0) return;
    await this.prisma.ticket.updateMany({ where: { id: { in: ids }, empresaId }, data: { vistoClienteAt: new Date() } });
  }

  async bannerHome(empresaId: string): Promise<BannerTicketHome | null> {
    const tickets = await this.prisma.ticket.findMany({
      where: { empresaId, deletedAt: null, estado: { in: ['abierto', 'en_proceso'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, numeroTicket: true, vistoClienteAt: true, respuestas: { select: { esAdmin: true, createdAt: true }, orderBy: { createdAt: 'asc' } } },
    });

    for (const t of tickets) {
      const ultima = t.respuestas[t.respuestas.length - 1];
      if (!ultima?.esAdmin) continue;
      const esNueva = !t.vistoClienteAt || ultima.createdAt > t.vistoClienteAt;
      if (esNueva) return { tipo: 'respuesta', id: t.id, numero: t.numeroTicket };
    }
    const sinAdmin = tickets.find((t) => !t.respuestas.some((r) => r.esAdmin));
    if (sinAdmin) return { tipo: 'revision', id: sinAdmin.id, numero: sinAdmin.numeroTicket };
    return null;
  }

  async listarAdmin(): Promise<TicketFilaAdmin[]> {
    const tickets = await this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: {
        id: true,
        empresaId: true,
        numeroTicket: true,
        asunto: true,
        categoria: true,
        prioridad: true,
        estado: true,
        createdAt: true,
        empresa: { select: { nombre: true } },
      },
    });
    return tickets.map((t) => ({ ...toFila(t), empresaId: t.empresaId, empresaNombre: t.empresa.nombre }));
  }

  async cambiarEstado(id: string, estado: EstadoTicket): Promise<ResultadoTicket<true>> {
    const { count } = await this.prisma.ticket.updateMany({ where: { id }, data: { estado } });
    if (count === 0) return { ok: false, motivo: 'no_encontrado' };
    return { ok: true, valor: true };
  }
}
