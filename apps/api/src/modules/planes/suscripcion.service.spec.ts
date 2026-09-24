import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SuscripcionService } from './suscripcion.service.js';
import { SUSCRIPCION_REPOSITORY, type SuscripcionRepository } from './suscripcion.repository.js';

describe('SuscripcionService', () => {
  let service: SuscripcionService;
  let repository: { [K in keyof SuscripcionRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      activa: vi.fn(),
      iniciarPrueba: vi.fn(),
      listarPlanes: vi.fn(),
      listarSuscripciones: vi.fn(),
      marcarEmpresaDemo: vi.fn(),
      asignarSuscripcion: vi.fn(),
      cambiarEstadoSuscripcion: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [SuscripcionService, { provide: SUSCRIPCION_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(SuscripcionService);
  });

  it('estado() combina la suscripción activa con días restantes/enTrial/trialVencido', async () => {
    repository.activa.mockResolvedValue({ id: 's1', estado: 'periodo_prueba', fechaVencimiento: '2099-01-01' });
    const res = await service.estado('empresa-1');
    expect(res.enTrial).toBe(true);
    expect(res.trialVencido).toBe(false);
    expect(res.diasRestantes).toBeGreaterThan(0);
  });

  it('estado() sin suscripción devuelve el estado vacío sin explotar', async () => {
    repository.activa.mockResolvedValue(null);
    const res = await service.estado('empresa-1');
    expect(res.suscripcion).toBeNull();
    expect(res.enTrial).toBe(false);
    expect(res.diasRestantes).toBe(0);
  });

  it('asignarSuscripcion() lanza NotFoundException si la empresa es inválida', async () => {
    repository.asignarSuscripcion.mockResolvedValue({ ok: false, motivo: 'empresa_invalida' });
    await expect(service.asignarSuscripcion('e1', 'p1', '2026-01-01')).rejects.toThrow(NotFoundException);
  });

  it('asignarSuscripcion() lanza BadRequestException si el plan es inválido', async () => {
    repository.asignarSuscripcion.mockResolvedValue({ ok: false, motivo: 'plan_invalido' });
    await expect(service.asignarSuscripcion('e1', 'p1', '2026-01-01')).rejects.toThrow(BadRequestException);
  });

  it('cambiarEstadoSuscripcion() lanza NotFoundException si la suscripción no existe', async () => {
    repository.cambiarEstadoSuscripcion.mockResolvedValue({ ok: false, motivo: 'suscripcion_invalida' });
    await expect(service.cambiarEstadoSuscripcion('s1', 'activa')).rejects.toThrow(NotFoundException);
  });
});
