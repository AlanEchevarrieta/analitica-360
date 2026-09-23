import { Controller, Get, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AnalyticsPeriodoService } from './periodo.service.js';
import { periodoQuerySchema, type PeriodoQuery } from './periodo.dto.js';

@Controller('analytics/periodo')
@RequireModulo('analytics')
export class AnalyticsPeriodoController {
  constructor(private readonly periodoService: AnalyticsPeriodoService) {}

  @Get()
  periodo(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(periodoQuerySchema)) query: PeriodoQuery,
  ) {
    return this.periodoService.periodo(empresa.id, query.desde, query.hasta, query.granularidad);
  }
}
