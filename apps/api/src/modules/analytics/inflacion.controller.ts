import { Controller, Get, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { InflacionService } from './inflacion.service.js';
import { inflacionQuerySchema, type InflacionQuery } from './inflacion.dto.js';

@Controller('analytics/inflacion')
@RequireModulo('insights')
export class InflacionController {
  constructor(private readonly inflacionService: InflacionService) {}

  @Get()
  inflacionVsPrecios(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(inflacionQuerySchema)) query: InflacionQuery,
  ) {
    return this.inflacionService.inflacionVsPrecios(empresa.id, query.desde, query.hasta);
  }
}
