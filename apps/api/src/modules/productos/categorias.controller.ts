import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CategoriasService } from './categorias.service.js';
import {
  guardarCategoriaSchema,
  listarCategoriasQuerySchema,
  type GuardarCategoriaInput,
  type ListarCategoriasQuery,
} from './categorias.dto.js';

@Controller('categorias')
@RequireModulo('productos')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(listarCategoriasQuerySchema)) query: ListarCategoriasQuery,
  ) {
    return this.categoriasService.listar(empresa.id, query.soloActivas);
  }

  @Post()
  @RequirePermiso('editar_productos')
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body(new ZodValidationPipe(guardarCategoriaSchema)) body: GuardarCategoriaInput,
  ) {
    return this.categoriasService.crear(empresa.id, body);
  }

  @Patch(':id')
  @RequirePermiso('editar_productos')
  actualizar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(guardarCategoriaSchema)) body: GuardarCategoriaInput,
  ) {
    return this.categoriasService.actualizar(empresa.id, id, body);
  }

  @Delete(':id')
  @RequirePermiso('editar_productos')
  eliminar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.categoriasService.eliminar(empresa.id, id);
  }
}
