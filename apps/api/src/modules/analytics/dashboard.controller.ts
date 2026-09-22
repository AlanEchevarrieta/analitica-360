import { Controller, Get, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { DashboardService } from './dashboard.service.js';
import { serieHomeQuerySchema, type SerieHomeQuery } from './dashboard.dto.js';

@Controller('analytics/dashboard')
@RequireModulo('analytics')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  inicio(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.dashboardService.inicio(empresa.id);
  }

  @Get('serie-home')
  serieHome(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(serieHomeQuerySchema)) query: SerieHomeQuery,
  ) {
    return this.dashboardService.serieHome(empresa.id, query.dias);
  }
}
