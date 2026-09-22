import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AtributosService } from './atributos.service.js';
import { guardarAtributoSchema, type GuardarAtributoInput } from './atributos.dto.js';

@Controller('atributos')
@RequireModulo('productos')
export class AtributosController {
  constructor(private readonly atributosService: AtributosService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.atributosService.listar(empresa.id);
  }

  @Post()
  @RequirePermiso('editar_productos')
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body(new ZodValidationPipe(guardarAtributoSchema)) body: GuardarAtributoInput,
  ) {
    return this.atributosService.crear(empresa.id, body);
  }

  @Post('sembrar-default')
  @RequirePermiso('editar_productos')
  sembrarDefault(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.atributosService.sembrarDefault(empresa.id);
  }

  @Patch(':id')
  @RequirePermiso('editar_productos')
  actualizar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(guardarAtributoSchema)) body: GuardarAtributoInput,
  ) {
    return this.atributosService.actualizar(empresa.id, id, body);
  }

  @Delete(':id')
  @RequirePermiso('editar_productos')
  eliminar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.atributosService.eliminar(empresa.id, id);
  }
}
