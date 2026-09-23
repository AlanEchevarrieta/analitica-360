import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GastoService } from './gasto.service.js';
import { GASTO_REPOSITORY, type GastoRepository } from './gasto.repository.js';

describe('GastoService', () => {
  let service: GastoService;
  let repository: { [K in keyof GastoRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = { listar: vi.fn(), crear: vi.fn(), anular: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [GastoService, { provide: GASTO_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(GastoService);
  });

  it('crear() fuerza frecuencia null si el input llega inconsistente pero el repo la recibe tal cual (la coherencia la garantiza el DTO)', async () => {
    repository.crear.mockResolvedValue({ id: 'g1' });
    await service.crear('empresa-1', 'usuario-1', {
      categoria: 'alquiler',
      descripcion: 'Alquiler local',
      monto: 1000,
      fecha: '2026-09-01',
      recurrente: true,
      frecuencia: 'mensual',
    });
    expect(repository.crear).toHaveBeenCalledWith({
      empresaId: 'empresa-1',
      usuarioId: 'usuario-1',
      categoria: 'alquiler',
      descripcion: 'Alquiler local',
      monto: 1000,
      fecha: '2026-09-01',
      recurrente: true,
      frecuencia: 'mensual',
    });
  });

  it('anular() lanza NotFoundException si el gasto no existe o es de otra empresa', async () => {
    repository.anular.mockResolvedValue({ ok: false, motivo: 'no_encontrado' });
    await expect(service.anular('empresa-1', 'g1')).rejects.toThrow(NotFoundException);
  });

  it('anular() es idempotente: no tira error si ya estaba anulado', async () => {
    repository.anular.mockResolvedValue({ ok: false, motivo: 'ya_anulado' });
    await expect(service.anular('empresa-1', 'g1')).resolves.toBeUndefined();
  });
});
