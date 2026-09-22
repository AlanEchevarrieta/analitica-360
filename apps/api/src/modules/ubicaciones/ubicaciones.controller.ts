import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { UbicacionesService } from './ubicaciones.service.js';
import {
  guardarUbicacionSchema,
  listarUbicacionesQuerySchema,
  type GuardarUbicacionInput,
  type ListarUbicacionesQuery,
} from './ubicaciones.dto.js';

@Controller('ubicaciones')
@RequireModulo('inventario')
export class UbicacionesController {
  constructor(private readonly ubicacionesService: UbicacionesService) {}

  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(listarUbicacionesQuerySchema)) query: ListarUbicacionesQuery,
  ) {
    return this.ubicacionesService.listar(empresa.id, query.soloActivas);
  }

  @Post()
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body(new ZodValidationPipe(guardarUbicacionSchema)) body: GuardarUbicacionInput,
  ) {
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
