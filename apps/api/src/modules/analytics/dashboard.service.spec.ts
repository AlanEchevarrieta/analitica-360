import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service.js';
import { DASHBOARD_REPOSITORY, type DashboardInicioBase, type DashboardRepository } from './dashboard.repository.js';
import { ClientesService } from '../clientes/clientes.service.js';

const baseInicio: DashboardInicioBase = {
  hoy: { cantidad: 2, total: 500 },
  semana: 1500,
  mes: 4000,
  comprasMes: 1000,
  topHoy: { nombre: 'Yerba', unidades: 3 },
  ultimos7: [],
  top5: [],
  stock: [],
  alertasStock: [],
};

describe('DashboardService', () => {
  let service: DashboardService;
  let repository: { [K in keyof DashboardRepository]: ReturnType<typeof vi.fn> };
  let clientesService: { cumpleanosProximos: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = { inicio: vi.fn(), serieHome: vi.fn() };
    clientesService = { cumpleanosProximos: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DASHBOARD_REPOSITORY, useValue: repository },
        { provide: ClientesService, useValue: clientesService },
      ],
    }).compile();
    service = module.get(DashboardService);
  });

  it('inicio() combina la base con los cumpleaños (top 5, mapeados a id/nombre/dias)', async () => {
    repository.inicio.mockResolvedValue(baseInicio);
    clientesService.cumpleanosProximos.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({ id: `cli-${i}`, nombre: `Cliente ${i}`, telefono: null, dias: i })),
    );
    const resultado = await service.inicio('empresa-1');
    expect(clientesService.cumpleanosProximos).toHaveBeenCalledWith('empresa-1', 7);
    expect(resultado.cumples).toHaveLength(5);
    expect(resultado.cumples[0]).toEqual({ id: 'cli-0', nombre: 'Cliente 0', dias: 0 });
    expect(resultado.hoy).toEqual(baseInicio.hoy);
  });

  it('serieHome() delega al repositorio', async () => {
    repository.serieHome.mockResolvedValue([]);
    await service.serieHome('empresa-1', 30);
    expect(repository.serieHome).toHaveBeenCalledWith('empresa-1', 30);
  });
});
