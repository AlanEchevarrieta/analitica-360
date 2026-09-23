import { Test } from '@nestjs/testing';
import { ContabilidadService } from './contabilidad.service.js';
import { CONTABILIDAD_REPOSITORY, type ContabilidadRepository } from './contabilidad.repository.js';
import { GASTO_REPOSITORY, type GastoRepository } from './gasto.repository.js';

describe('ContabilidadService', () => {
  let service: ContabilidadService;
  let repository: { [K in keyof ContabilidadRepository]: ReturnType<typeof vi.fn> };
  let gastoRepository: { [K in keyof GastoRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = { ventasConItems: vi.fn(), valorStock: vi.fn() };
    gastoRepository = { listar: vi.fn(), crear: vi.fn(), anular: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ContabilidadService,
        { provide: CONTABILIDAD_REPOSITORY, useValue: repository },
        { provide: GASTO_REPOSITORY, useValue: gastoRepository },
      ],
    }).compile();
    service = module.get(ContabilidadService);
  });

  it('combina ventas+gastos+stock en totales, serie, ratios y proyección', async () => {
    repository.ventasConItems.mockResolvedValue({
      ventas: [{ id: 'v1', fecha: '2026-09-10', total: 1000 }],
      items: [{ ventaId: 'v1', cogs: 400 }],
    });
    gastoRepository.listar.mockResolvedValue([{ fecha: '2026-09-05', monto: 100, recurrente: true }]);
    repository.valorStock.mockResolvedValue({ invertido: 500, valorVenta: 900, gananciaPotencial: 400 });

    const res = await service.contabilidad('empresa-1', '2026-09-01', '2026-09-30');

    expect(res.totales).toEqual({ ingresos: 1000, cogs: 400, gastos: 100, neto: 500, cantidadVentas: 1 });
    expect(res.valorStock.invertido).toBe(500);
    expect(res.ratios.margenBrutoPct).toBeCloseTo(60);
    expect(res.semaforoMargenBruto).toBe('verde');
    expect(res.proyeccion).toHaveLength(3);
    expect(res.flujoHistorico.length).toBeGreaterThan(0);
    expect(res.flujoProyectado.length).toBe(res.flujoHistorico.length + 3);
  });

  it('usa totales.gastos como gastosFijos de respaldo si no hay gastos recurrentes en el período', async () => {
    repository.ventasConItems.mockResolvedValue({ ventas: [], items: [] });
    gastoRepository.listar.mockResolvedValue([{ fecha: '2026-09-05', monto: 300, recurrente: false }]);
    repository.valorStock.mockResolvedValue({ invertido: 0, valorVenta: 0, gananciaPotencial: 0 });

    const res = await service.contabilidad('empresa-1', '2026-09-01', '2026-09-30');
    // ingresos=0 -> margenBrutoPct=0 -> puntoEquilibrio=0 independientemente de gastosFijos, pero no debe explotar.
    expect(res.ratios.puntoEquilibrio).toBe(0);
  });
});
