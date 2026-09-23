import { Test } from '@nestjs/testing';
import { InsightsService } from './insights.service.js';
import { INSIGHTS_REPOSITORY, type InsightsRepository } from './insights.repository.js';

describe('InsightsService', () => {
  let service: InsightsService;
  let repository: { [K in keyof InsightsRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      productosConStock: vi.fn(),
      ventasRango: vi.fn(),
      itemsDeVentas: vi.fn(),
      historialPrecios: vi.fn(),
      diasDesdePrimeraVenta: vi.fn(),
      serieVentasHistorial: vi.fn(),
      usaVariantes: vi.fn(),
      variantesDeProductos: vi.fn(),
      stockPorVariante: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [InsightsService, { provide: INSIGHTS_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(InsightsService);
  });

  it('devuelve todo vacío con error compartido si falla la carga inicial de datos', async () => {
    repository.productosConStock.mockRejectedValue(new Error('boom'));
    repository.ventasRango.mockResolvedValue([]);
    repository.historialPrecios.mockResolvedValue([]);
    repository.diasDesdePrimeraVenta.mockResolvedValue(0);
    repository.serieVentasHistorial.mockResolvedValue([]);
    repository.usaVariantes.mockResolvedValue(false);

    const res = await service.insights('empresa-1');
    expect(res.salud).toBeNull();
    expect(res.errores.radar).toBe('boom');
    expect(res.errores.elasticidad).toBe('boom');
    expect(repository.itemsDeVentas).not.toHaveBeenCalled();
  });

  it('no arma variantes si usaVariantes es false, aunque haya ítems con variante', async () => {
    repository.productosConStock.mockResolvedValue([]);
    repository.ventasRango.mockResolvedValue([]);
    repository.itemsDeVentas.mockResolvedValue([]);
    repository.historialPrecios.mockResolvedValue([]);
    repository.diasDesdePrimeraVenta.mockResolvedValue(10);
    repository.serieVentasHistorial.mockResolvedValue([]);
    repository.usaVariantes.mockResolvedValue(false);

    const res = await service.insights('empresa-1');
    expect(res.variantes).toBeNull();
    expect(repository.variantesDeProductos).not.toHaveBeenCalled();
  });

  it('sin suficiente historial (< 30 días) no calcula forecast', async () => {
    repository.productosConStock.mockResolvedValue([]);
    repository.ventasRango.mockResolvedValue([]);
    repository.itemsDeVentas.mockResolvedValue([]);
    repository.historialPrecios.mockResolvedValue([]);
    repository.diasDesdePrimeraVenta.mockResolvedValue(5);
    repository.serieVentasHistorial.mockResolvedValue([{ fecha: '2026-09-01', total: 100 }]);
    repository.usaVariantes.mockResolvedValue(false);

    const res = await service.insights('empresa-1');
    expect(res.forecast).toBeNull();
    expect(res.diasHistorial).toBe(5);
  });
});
