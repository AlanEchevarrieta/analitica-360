import { Controller, Get, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { InsightsCombosService } from './combos.service.js';
import { combosQuerySchema, type CombosQuery } from './combos.dto.js';

@Controller('analytics/insights')
@RequireModulo('insights')
export class InsightsCombosController {
  constructor(private readonly combosService: InsightsCombosService) {}

  @Get('combos')
  combos(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(combosQuerySchema)) query: CombosQuery,
  ) {
    return this.combosService.combos(empresa.id, query.limite);
  }

  @Get('combos-3')
  combos3(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(combosQuerySchema)) query: CombosQuery,
  ) {
    return this.combosService.combos3(empresa.id, query.limite);
  }
}
