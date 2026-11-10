import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GastoService } from './gasto.service.js';
import { GASTO_REPOSITORY, type GastoRepository } from './gasto.repository.js';

describe('GastoService', () => {
  let service: GastoService;
  let repository: { [K in keyof GastoRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listar: vi.fn(),
      crear: vi.fn(),
      editar: vi.fn(),
      dejarDeRepetir: vi.fn(),
      cambiarMontoDesde: vi.fn(),
      anular: vi.fn(),
      cambiarTipoCosto: vi.fn(),
    };
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
      tipoCosto: 'fijo',
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
      tipoCosto: 'fijo',
    });
  });

  it('dejarDeRepetir() guarda fechaFin = desde - 1 día', async () => {
    repository.dejarDeRepetir.mockResolvedValue({ id: 'g1', fechaFin: '2026-11-30' });
    await service.dejarDeRepetir('empresa-1', 'g1', '2026-12-01');
    expect(repository.dejarDeRepetir).toHaveBeenCalledWith('empresa-1', 'g1', '2026-11-30');
  });

  it('cambiarMontoDesde() cierra el gasto anterior el día previo y crea el nuevo desde la fecha indicada', async () => {
    repository.cambiarMontoDesde.mockResolvedValue({ id: 'g2', monto: 65000, fecha: '2026-11-01' });
    await service.cambiarMontoDesde('empresa-1', 'usuario-1', 'g1', { desde: '2026-11-01', monto: 65000 });
    expect(repository.cambiarMontoDesde).toHaveBeenCalledWith('empresa-1', 'usuario-1', 'g1', '2026-11-01', '2026-10-31', 65000);
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
