import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { guardarObjetivoSchema, metaPeriodoSchema, type GuardarObjetivoInput, type MetaPeriodoInput } from './objetivos.dto.js';
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

  @Get('avisos')
  avisos(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext) {
    return this.objetivos.avisos(empresa.id, usuario);
  }

  @Post('avisos/:id/leido')
  @HttpCode(204)
  async avisoLeido(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.objetivos.marcarAvisoLeido(empresa.id, usuario, id);
  }

  @Put(':id/metas')
  @HttpCode(204)
  async metaPeriodo(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(metaPeriodoSchema)) body: MetaPeriodoInput,
  ) {
    await this.objetivos.fijarMetaPeriodo(empresa.id, usuario, id, body.desde, body.meta);
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
