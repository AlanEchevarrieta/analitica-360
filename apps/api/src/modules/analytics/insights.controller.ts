import { Controller, Get } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { InsightsService } from './insights.service.js';

@Controller('analytics/insights')
@RequireModulo('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  insights(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.insightsService.insights(empresa.id);
  }
}
