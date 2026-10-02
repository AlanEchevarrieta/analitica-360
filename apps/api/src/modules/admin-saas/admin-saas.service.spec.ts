import { Test } from '@nestjs/testing';
import { PrismaAdminClientesRepository } from './prisma-admin-clientes.repository.js';
import { AdminSaasService } from './admin-saas.service.js';
import { ADMIN_SAAS_REPOSITORY, type AdminSaasRepository } from './admin-saas.repository.js';

describe('AdminSaasService', () => {
  let service: AdminSaasService;
  let repository: { [K in keyof AdminSaasRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = { metrics: vi.fn(), capacidad: vi.fn(), listarPagos: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [AdminSaasService, { provide: ADMIN_SAAS_REPOSITORY, useValue: repository }, { provide: PrismaAdminClientesRepository, useValue: {} }],
    }).compile();
    service = module.get(AdminSaasService);
  });

  it('listarPagos() convierte strings vacíos a null antes de pasarlos al repositorio', async () => {
    repository.listarPagos.mockResolvedValue([]);
    await service.listarPagos('', '');
    expect(repository.listarPagos).toHaveBeenCalledWith(null, null);
  });

});
