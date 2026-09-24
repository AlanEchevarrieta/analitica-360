import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminSaasService } from './admin-saas.service.js';
import { ADMIN_SAAS_REPOSITORY, type AdminSaasRepository } from './admin-saas.repository.js';

describe('AdminSaasService', () => {
  let service: AdminSaasService;
  let repository: { [K in keyof AdminSaasRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = { metrics: vi.fn(), capacidad: vi.fn(), listarPagos: vi.fn(), registrarPago: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [AdminSaasService, { provide: ADMIN_SAAS_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(AdminSaasService);
  });

  it('listarPagos() convierte strings vacíos a null antes de pasarlos al repositorio', async () => {
    repository.listarPagos.mockResolvedValue([]);
    await service.listarPagos('', '');
    expect(repository.listarPagos).toHaveBeenCalledWith(null, null);
  });

  it('registrarPago() lanza NotFoundException si la empresa no existe', async () => {
    repository.registrarPago.mockResolvedValue({ ok: false, motivo: 'empresa_invalida' });
    await expect(service.registrarPago({ empresaId: 'e1', monto: 100, metodo: 'transferencia', periodo: '2026-09', notas: '' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('registrarPago() lanza BadRequestException si el monto es inválido', async () => {
    repository.registrarPago.mockResolvedValue({ ok: false, motivo: 'monto_invalido' });
    await expect(service.registrarPago({ empresaId: 'e1', monto: 100, metodo: 'transferencia', periodo: '2026-09', notas: '' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('registrarPago() devuelve el id creado en el caso exitoso', async () => {
    repository.registrarPago.mockResolvedValue({ ok: true, id: 'pago-1' });
    const res = await service.registrarPago({ empresaId: 'e1', monto: 100, metodo: 'transferencia', periodo: '2026-09', notas: '' });
    expect(res).toEqual({ id: 'pago-1' });
  });
});
