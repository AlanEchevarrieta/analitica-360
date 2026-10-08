import { Controller, Get, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ContabilidadService } from './contabilidad.service.js';
import { contabilidadQuerySchema, equilibrioQuerySchema, type ContabilidadQuery, type EquilibrioQuery } from './contabilidad.dto.js';
import { CacheLectura } from '../../common/cache/cache-lecturas.js';

@Controller('contabilidad')
@RequireModulo('contabilidad')
@CacheLectura()
export class ContabilidadController {
  constructor(private readonly contabilidadService: ContabilidadService) {}

  /** Punto de equilibrio del mes en curso (tarjeta de Inicio). */
  @Get('equilibrio')
  equilibrio(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(equilibrioQuerySchema)) query: EquilibrioQuery) {
    return this.contabilidadService.equilibrio(empresa.id, query.moneda);
  }

  @Get()
  contabilidad(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(contabilidadQuerySchema)) query: ContabilidadQuery,
  ) {
    return this.contabilidadService.contabilidad(empresa.id, query.desde, query.hasta, query.moneda);
  }
}
