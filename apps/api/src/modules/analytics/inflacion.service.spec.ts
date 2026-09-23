import { Test } from '@nestjs/testing';
import { InflacionService } from './inflacion.service.js';
import { BcraInflacionClient } from './bcra-inflacion.client.js';
import { INFLACION_REPOSITORY, type InflacionRepository } from './inflacion.repository.js';

describe('InflacionService', () => {
  let service: InflacionService;
  let repository: { [K in keyof InflacionRepository]: ReturnType<typeof vi.fn> };
  let bcra: { inflacionDesdeBcra: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = { preciosPromedioHistorial: vi.fn(), preciosPromedioVentasItems: vi.fn() };
    bcra = { inflacionDesdeBcra: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [
        InflacionService,
        { provide: INFLACION_REPOSITORY, useValue: repository },
        { provide: BcraInflacionClient, useValue: bcra },
      ],
    }).compile();
    service = module.get(InflacionService);
  });

  it('usa la tabla estática y no llama al BCRA cuando todos los meses están cubiertos', async () => {
    repository.preciosPromedioHistorial.mockResolvedValue(new Map([['2024-05', 100]]));
    const res = await service.inflacionVsPrecios('empresa-1', '2024-05-01', '2024-05-31');
    expect(bcra.inflacionDesdeBcra).not.toHaveBeenCalled();
    expect(res.errorInflacion).toBeNull();
    expect(res.puntos[0].inflacion).toBe(4.2);
  });

  it('completa con el BCRA los meses fuera de la tabla estática', async () => {
    repository.preciosPromedioHistorial.mockResolvedValue(new Map());
    repository.preciosPromedioVentasItems.mockResolvedValue(new Map());
    bcra.inflacionDesdeBcra.mockResolvedValue({ '2026-01': 2.1 });
    const res = await service.inflacionVsPrecios('empresa-1', '2026-01-01', '2026-01-31');
    expect(bcra.inflacionDesdeBcra).toHaveBeenCalledWith('2026-01-01', '2026-01-31');
    expect(res.puntos[0].inflacion).toBe(2.1);
    expect(res.errorInflacion).toBeNull();
  });

  it('sin datos de inflación (ni tabla ni BCRA) devuelve la serie vacía con error', async () => {
    bcra.inflacionDesdeBcra.mockResolvedValue(null);
    const res = await service.inflacionVsPrecios('empresa-1', '2026-01-01', '2026-01-31');
    expect(res.errorInflacion).toBe('Datos de inflación no disponibles para este período');
    expect(res.puntos).toEqual([]);
    expect(repository.preciosPromedioHistorial).not.toHaveBeenCalled();
  });

  it('recurre a precios de ventas_items solo si no hay historial', async () => {
    repository.preciosPromedioHistorial.mockResolvedValue(new Map());
    repository.preciosPromedioVentasItems.mockResolvedValue(new Map([['2024-05', 80]]));
    const res = await service.inflacionVsPrecios('empresa-1', '2024-05-01', '2024-05-31');
    expect(repository.preciosPromedioVentasItems).toHaveBeenCalledWith('empresa-1', '2024-05-01', '2024-05-31');
    expect(res.hayPrecios).toBe(true);
  });
});
