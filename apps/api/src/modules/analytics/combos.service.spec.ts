import { Test } from '@nestjs/testing';
import { InsightsCombosService } from './combos.service.js';
import { INSIGHTS_COMBOS_REPOSITORY, type InsightsCombosRepository } from './combos.repository.js';

describe('InsightsCombosService', () => {
  let service: InsightsCombosService;
  let repository: { [K in keyof InsightsCombosRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = { combos: vi.fn(), combos3: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [InsightsCombosService, { provide: INSIGHTS_COMBOS_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(InsightsCombosService);
  });

  it('delega combos() al repositorio con el límite', async () => {
    repository.combos.mockResolvedValue([]);
    await service.combos('empresa-1', 5);
    expect(repository.combos).toHaveBeenCalledWith('empresa-1', 5);
  });

  it('delega combos3() al repositorio con el límite', async () => {
    repository.combos3.mockResolvedValue([]);
    await service.combos3('empresa-1', 5);
    expect(repository.combos3).toHaveBeenCalledWith('empresa-1', 5);
  });
});
