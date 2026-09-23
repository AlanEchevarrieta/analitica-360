import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TicketService } from './ticket.service.js';
import { TICKET_REPOSITORY, type TicketRepository } from './ticket.repository.js';

describe('TicketService', () => {
  let service: TicketService;
  let repository: { [K in keyof TicketRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listar: vi.fn(),
      ficha: vi.fn(),
      crear: vi.fn(),
      responder: vi.fn(),
      marcarVisto: vi.fn(),
      contarNoLeidos: vi.fn(),
      marcarTodosVistos: vi.fn(),
      bannerHome: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [TicketService, { provide: TICKET_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(TicketService);
  });

  it('ficha() lanza NotFoundException si el ticket no existe o no pertenece a la empresa', async () => {
    repository.ficha.mockResolvedValue(null);
    await expect(service.ficha('empresa-1', 'x')).rejects.toThrow(NotFoundException);
  });

  it('responder() lanza ConflictException si el ticket está cerrado', async () => {
    repository.responder.mockResolvedValue({ ok: false, motivo: 'ticket_cerrado' });
    await expect(service.responder('empresa-1', 'usuario-1', 't1', 'hola')).rejects.toThrow(ConflictException);
  });

  it('responder() lanza NotFoundException si el ticket no existe', async () => {
    repository.responder.mockResolvedValue({ ok: false, motivo: 'no_encontrado' });
    await expect(service.responder('empresa-1', 'usuario-1', 't1', 'hola')).rejects.toThrow(NotFoundException);
  });

  it('marcarVisto() lanza NotFoundException si no existe', async () => {
    repository.marcarVisto.mockResolvedValue({ ok: false, motivo: 'no_encontrado' });
    await expect(service.marcarVisto('empresa-1', 't1')).rejects.toThrow(NotFoundException);
  });

  it('crear() delega directo al repositorio con empresaId/usuarioId', async () => {
    repository.crear.mockResolvedValue({ id: 't1' });
    await service.crear('empresa-1', 'usuario-1', { asunto: 'A', descripcion: 'D'.repeat(20), categoria: 'consulta', prioridad: 'media' });
    expect(repository.crear).toHaveBeenCalledWith({
      empresaId: 'empresa-1',
      usuarioId: 'usuario-1',
      asunto: 'A',
      descripcion: 'D'.repeat(20),
      categoria: 'consulta',
      prioridad: 'media',
    });
  });
});
