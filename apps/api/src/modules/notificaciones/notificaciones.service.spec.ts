import { Test } from '@nestjs/testing';
import { NotificacionesService } from './notificaciones.service.js';
import { NOTIFICACIONES_REPOSITORY, type NotificacionesRepository } from './notificaciones.repository.js';

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  let repository: { [K in keyof NotificacionesRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = { contar: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [NotificacionesService, { provide: NOTIFICACIONES_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(NotificacionesService);
  });

  it('delega contar() al repositorio', async () => {
    repository.contar.mockResolvedValue({ tickets: 1, pedidos: 2, lotesVencidos: 3, lotesPorVencer: 4 });
    const res = await service.contar('empresa-1');
    expect(repository.contar).toHaveBeenCalledWith('empresa-1');
    expect(res).toEqual({ tickets: 1, pedidos: 2, lotesVencidos: 3, lotesPorVencer: 4 });
  });
});
