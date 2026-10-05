import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { UbicacionesService } from './ubicaciones.service.js';
import { AccesoCuentaService } from '../planes/acceso-cuenta.service.js';
import { PLANES } from '../planes/planes.util.js';
import {
  guardarUbicacionSchema,
  listarUbicacionesQuerySchema,
  type GuardarUbicacionInput,
  type ListarUbicacionesQuery,
} from './ubicaciones.dto.js';

@Controller('ubicaciones')
@RequireModulo('inventario')
export class UbicacionesController {
  constructor(
    private readonly ubicacionesService: UbicacionesService,
    private readonly acceso: AccesoCuentaService,
  ) {}

  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(listarUbicacionesQuerySchema)) query: ListarUbicacionesQuery,
  ) {
    return this.ubicacionesService.listar(empresa.id, query.soloActivas);
  }

  @Post()
  async crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body(new ZodValidationPipe(guardarUbicacionSchema)) body: GuardarUbicacionInput,
  ) {
    const plan = await this.acceso.planDe(empresa.id);
    if (plan.maxUbicaciones != null && plan.ubicaciones >= plan.maxUbicaciones) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'plan_limite_ubicaciones',
        planMinimo: 'pro',
        message: `El plan ${PLANES[plan.plan].nombre} permite ${plan.maxUbicaciones} ubicaciones. Para sumar más, pasate a Pro.`,
      });
    }
    this.acceso.olvidar(empresa.id);
    return this.ubicacionesService.crear(empresa.id, body);
  }

  @Patch(':id')
  actualizar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(guardarUbicacionSchema)) body: GuardarUbicacionInput,
  ) {
    return this.ubicacionesService.actualizar(empresa.id, id, body);
  }

  @Delete(':id')
  eliminar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.ubicacionesService.eliminar(empresa.id, id);
  }
}
