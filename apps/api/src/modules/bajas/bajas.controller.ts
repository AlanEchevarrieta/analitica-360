import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PermitidoSinSuscripcion } from '../../common/decorators/suscripcion.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BajasService } from './bajas.service.js';

const confirmarSchema = z.object({ confirmacion: z.string().trim().min(1, 'Escribí el nombre del negocio para confirmar').max(200) });

/** Baja de la cuenta: solo el dueño, y anda aunque la cuenta esté bloqueada (para poder cancelarla). */
@Controller('cuenta/baja')
@PermitidoSinSuscripcion()
export class BajasController {
  constructor(private readonly bajas: BajasService) {}

  @Get()
  @Roles('dueno')
  estado(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.bajas.estado(empresa.id);
  }

  @Post()
  @Roles('dueno')
  solicitar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(confirmarSchema)) body: { confirmacion: string }) {
    return this.bajas.solicitar(empresa.id, usuario.email, body.confirmacion);
  }

  @Delete()
  @Roles('dueno')
  cancelar(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.bajas.cancelar(empresa.id);
  }
}

/** Consola: ver, pedir (con los mismos 30 días), cancelar o ejecutar ya (cuando el cliente lo pidió por escrito). */
@Controller('admin/bajas')
@RequireAdminApp()
export class AdminBajasController {
  constructor(private readonly bajas: BajasService) {}

  @Get()
  listar() {
    return this.bajas.listar();
  }

  @Get(':empresaId')
  estado(@Param('empresaId', ParseUUIDPipe) empresaId: string) {
    return this.bajas.estado(empresaId);
  }

  @Post(':empresaId')
  solicitar(@Param('empresaId', ParseUUIDPipe) empresaId: string, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(confirmarSchema)) body: { confirmacion: string }) {
    return this.bajas.solicitar(empresaId, `consola: ${usuario.email}`, body.confirmacion);
  }

  @Delete(':empresaId')
  cancelar(@Param('empresaId', ParseUUIDPipe) empresaId: string) {
    return this.bajas.cancelar(empresaId);
  }

  @Post(':empresaId/ejecutar')
  @HttpCode(200)
  ejecutar(@Param('empresaId', ParseUUIDPipe) empresaId: string) {
    return this.bajas.ejecutar(empresaId);
  }
}
