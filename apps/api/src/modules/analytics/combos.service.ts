import { Inject, Injectable } from '@nestjs/common';
import {
  INSIGHTS_COMBOS_REPOSITORY,
  type InsightCombo2,
  type InsightCombo3,
  type InsightsCombosRepository,
} from './combos.repository.js';

@Injectable()
export class InsightsCombosService {
  constructor(
    @Inject(INSIGHTS_COMBOS_REPOSITORY) private readonly repository: InsightsCombosRepository,
  ) {}

  combos(empresaId: string, limite: number): Promise<InsightCombo2[]> {
    return this.repository.combos(empresaId, limite);
  }

  combos3(empresaId: string, limite: number): Promise<InsightCombo3[]> {
    return this.repository.combos3(empresaId, limite);
  }
}
