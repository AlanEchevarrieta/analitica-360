import { Controller, Get, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AnalyticsPeriodoService } from './periodo.service.js';
import { RendimientoService } from './rendimiento.service.js';
import { periodoQuerySchema, type PeriodoQuery } from './periodo.dto.js';
import { CacheLectura } from '../../common/cache/cache-lecturas.js';

@Controller('analytics/periodo')
@RequireModulo('analytics')
@CacheLectura()
export class AnalyticsPeriodoController {
  constructor(private readonly periodoService: AnalyticsPeriodoService) {}

  @Get()
  periodo(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(periodoQuerySchema)) query: PeriodoQuery,
  ) {
    return this.periodoService.periodo(empresa.id, query.desde, query.hasta, query.granularidad, query.moneda);
  }
}

/** Ventas por stand y por vendedor: participación, ticket promedio y variación. */
@Controller('analytics/rendimiento')
@RequireModulo('analytics')
@CacheLectura()
export class AnalyticsRendimientoController {
  constructor(private readonly service: RendimientoService) {}

  @Get()
  rendimiento(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(periodoQuerySchema)) query: PeriodoQuery) {
    return this.service.rendimiento(empresa.id, query.desde, query.hasta, query.moneda);
  }
}
