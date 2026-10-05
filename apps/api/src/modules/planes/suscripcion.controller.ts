import { Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { SuscripcionService } from './suscripcion.service.js';
import { AccesoCuentaService } from './acceso-cuenta.service.js';
import { PLANES } from './planes.util.js';
import { PermitidoSinSuscripcion } from '../../common/decorators/suscripcion.decorator.js';

// Estado de la cuenta y alta de la prueba: tienen que funcionar estando vencida.
@PermitidoSinSuscripcion()
@Controller('suscripcion')
export class SuscripcionController {
  constructor(
    private readonly suscripcionService: SuscripcionService,
    private readonly acceso: AccesoCuentaService,
  ) {}

  @Get()
  async estado(@CurrentEmpresa() empresa: EmpresaContext) {
    const [estado, p] = await Promise.all([this.suscripcionService.estado(empresa.id), this.acceso.planDe(empresa.id)]);
    // Lo que el plan permite: la web pone candados y avisa los límites (la API igual lo controla).
    return {
      ...estado,
      plan: {
        id: p.plan,
        nombre: PLANES[p.plan].nombre,
        funciones: p.funciones,
        maxUsuarios: p.maxUsuarios,
        maxUbicaciones: p.maxUbicaciones,
        usuarios: p.usuariosTotales,
        ubicaciones: p.ubicaciones,
      },
    };
  }

  @Post('iniciar-prueba')
  async iniciarPrueba(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Req() request: Request) {
    // Puerto de navigator.userAgent (browser-only en el legacy) - el header User-Agent HTTP cumple el mismo propósito de auditoría del lado servidor.
    const userAgent = request.headers['user-agent'] ?? null;
    await this.suscripcionService.iniciarPrueba(empresa.id, usuario.id, userAgent);
  }
}
