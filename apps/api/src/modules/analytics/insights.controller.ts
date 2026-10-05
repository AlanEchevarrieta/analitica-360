import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { InsightsService } from './insights.service.js';
import { CacheLectura } from '../../common/cache/cache-lecturas.js';

const insightsQuerySchema = z.object({ pronostico: z.enum(['semana', 'mes']).default('semana') });

@Controller('analytics/insights')
@RequireModulo('insights')
@CacheLectura()
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  insights(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(insightsQuerySchema)) q: z.infer<typeof insightsQuerySchema>) {
    return this.insightsService.insights(empresa.id, q.pronostico);
  }
}
