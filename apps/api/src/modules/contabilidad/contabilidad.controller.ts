import { Controller, Get, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ContabilidadService } from './contabilidad.service.js';
import { contabilidadQuerySchema, type ContabilidadQuery } from './contabilidad.dto.js';

@Controller('contabilidad')
@RequireModulo('contabilidad')
export class ContabilidadController {
  constructor(private readonly contabilidadService: ContabilidadService) {}

  @Get()
  contabilidad(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(contabilidadQuerySchema)) query: ContabilidadQuery,
  ) {
    return this.contabilidadService.contabilidad(empresa.id, query.desde, query.hasta);
  }
}
