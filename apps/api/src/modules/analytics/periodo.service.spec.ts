import { Test } from '@nestjs/testing';
import { AnalyticsPeriodoService, LIMITE_ANALYTICS_VENTAS } from './periodo.service.js';
import { ANALYTICS_PERIODO_REPOSITORY, type AnalyticsPeriodoRepository } from './periodo.repository.js';

describe('AnalyticsPeriodoService', () => {
  let service: AnalyticsPeriodoService;
  let repository: { [K in keyof AnalyticsPeriodoRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      contarVentas: vi.fn(),
      periodoBase: vi.fn(),
      evolucion: vi.fn(),
      formasPago: vi.fn(),
      topProductos: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [AnalyticsPeriodoService, { provide: ANALYTICS_PERIODO_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(AnalyticsPeriodoService);
  });

  it('corta antes de cargar el detalle si supera LIMITE_ANALYTICS_VENTAS', async () => {
    repository.contarVentas.mockResolvedValue(LIMITE_ANALYTICS_VENTAS + 1);
    const res = await service.periodo('empresa-1', '2026-01-01', '2026-01-31', 'dia');
    expect(res).toEqual({ avisoLimite: LIMITE_ANALYTICS_VENTAS + 1, data: null });
    expect(repository.periodoBase).not.toHaveBeenCalled();
  });

  it('combina periodoBase + evolucion + formasPago + topProductos, evolucionDiaria agrupada por día UTC de las ventas', async () => {
    repository.contarVentas.mockResolvedValue(3);
    repository.periodoBase.mockResolvedValue({
      totalVentas: 900,
      cantidad: 3,
      ticketPromedio: 300,
      costo: 400,
      porCobrar: 50,
      ventas: [
        { fecha: new Date('2026-01-10T14:00:00Z'), total: 500, formaPago: 'efectivo' },
        { fecha: new Date('2026-01-10T20:00:00Z'), total: 200, formaPago: 'qr' },
        { fecha: new Date('2026-01-11T02:00:00Z'), total: 200, formaPago: 'efectivo' },
      ],
      productos: [{ producto: 'Yerba', unidades: 5, total: 900, costo: 400, margen: 500, margenPct: 55.6 }],
    });
    repository.evolucion.mockResolvedValue([{ fecha: '2026-01-10', total: 700, anterior: 100, cantidad: 2 }]);
    repository.formasPago.mockResolvedValue([{ nombre: 'Efectivo', total: 700, cantidad: 2 }]);
    repository.topProductos.mockResolvedValue([{ nombre: 'Yerba', unidades: 5, total: 900 }]);

    const res = await service.periodo('empresa-1', '2026-01-10', '2026-01-11', 'dia');

    expect(res.avisoLimite).toBeNull();
    expect(res.data?.total).toBe(900);
    expect(res.data?.evolucionDiaria).toEqual([
      { fecha: '2026-01-10', total: 700 },
      { fecha: '2026-01-11', total: 200 },
    ]);
    expect(res.data?.top10).toEqual([{ nombre: 'Yerba', unidades: 5 }]);
    expect(res.data?.productos).toHaveLength(1);
  });
});
