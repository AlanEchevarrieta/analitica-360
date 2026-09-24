import { Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { SuscripcionService } from './suscripcion.service.js';

@Controller('suscripcion')
export class SuscripcionController {
  constructor(private readonly suscripcionService: SuscripcionService) {}

  @Get()
  estado(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.suscripcionService.estado(empresa.id);
  }

  @Post('iniciar-prueba')
  async iniciarPrueba(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Req() request: Request) {
    // Puerto de navigator.userAgent (browser-only en el legacy) - el header User-Agent HTTP cumple el mismo propósito de auditoría del lado servidor.
    const userAgent = request.headers['user-agent'] ?? null;
    await this.suscripcionService.iniciarPrueba(empresa.id, usuario.id, userAgent);
  }
}
