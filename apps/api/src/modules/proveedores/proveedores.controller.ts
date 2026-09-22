import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ProveedoresService } from './proveedores.service.js';
import {
  guardarProveedorSchema,
  listarProveedoresQuerySchema,
  type GuardarProveedorInput,
  type ListarProveedoresQuery,
} from './proveedores.dto.js';

@Controller('proveedores')
@RequireModulo('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(listarProveedoresQuerySchema)) query: ListarProveedoresQuery,
  ) {
    return this.proveedoresService.listar(empresa.id, query);
  }

  @Get(':id')
  ficha(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.proveedoresService.ficha(empresa.id, id);
  }

  @Post()
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body(new ZodValidationPipe(guardarProveedorSchema)) body: GuardarProveedorInput,
  ) {
    return this.proveedoresService.crear(empresa.id, body);
  }

  @Patch(':id')
  actualizar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(guardarProveedorSchema)) body: GuardarProveedorInput,
  ) {
    return this.proveedoresService.actualizar(empresa.id, id, body);
  }
}
