import { Controller, Get, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { DashboardService } from './dashboard.service.js';
import { monedaSchema } from '../cotizaciones/cotizaciones.module.js';
import type { Moneda } from '../cotizaciones/cotizaciones.service.js';
import { serieHomeQuerySchema, type SerieHomeQuery } from './dashboard.dto.js';
import { CacheLectura } from '../../common/cache/cache-lecturas.js';

// Los números del Inicio son de todos los planes (el permiso del usuario sigue siendo el de analytics).
@Controller('analytics/dashboard')
@RequireModulo('analytics')
@RequireFuncion('inicio')
@CacheLectura()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  inicio(@CurrentEmpresa() empresa: EmpresaContext, @Query('moneda', new ZodValidationPipe(monedaSchema)) moneda?: Moneda) {
    return this.dashboardService.inicio(empresa.id, moneda);
  }

  @Get('serie-home')
  serieHome(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(serieHomeQuerySchema)) query: SerieHomeQuery,
  ) {
    return this.dashboardService.serieHome(empresa.id, query.dias);
  }
}
