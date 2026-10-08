import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { guardarObjetivoSchema, type GuardarObjetivoInput } from './objetivos.dto.js';
import { ObjetivosService } from './objetivos.service.js';

/** Objetivos por período (empresa, sucursal o usuario) con su avance, ritmo y proyección. */
@Controller('objetivos')
@RequireFuncion('objetivos')
export class ObjetivosController {
  constructor(private readonly objetivos: ObjetivosService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext) {
    return this.objetivos.listar(empresa.id, usuario);
  }

  @Get('opciones')
  opciones(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.objetivos.opciones(empresa.id);
  }

  @Post()
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(guardarObjetivoSchema)) body: GuardarObjetivoInput,
  ) {
    return this.objetivos.crear(empresa.id, usuario, body);
  }

  @Patch(':id')
  actualizar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(guardarObjetivoSchema)) body: GuardarObjetivoInput,
  ) {
    return this.objetivos.actualizar(empresa.id, usuario, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async borrar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.objetivos.borrar(empresa.id, usuario, id);
  }
}
