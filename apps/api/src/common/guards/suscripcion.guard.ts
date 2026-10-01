import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { REQUIRE_ADMIN_APP_KEY } from '../decorators/admin-app.decorator.js';
import { EXPORTACION_KEY, PERMITIDO_SIN_SUSCRIPCION_KEY } from '../decorators/suscripcion.decorator.js';
import { AccesoCuentaService } from '../../modules/planes/acceso-cuenta.service.js';

const LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Corre al final de la cadena (después de EmpresaScopeGuard). Con la prueba o
 * el plan vencidos la empresa queda en solo lectura: puede ver todo pero no
 * cargar nada, salvo lo marcado con @PermitidoSinSuscripcion() (Planes,
 * Soporte). Con la prueba gratis vencida tampoco puede usar @Exportacion().
 * El `code` del 403 le permite a la web reconocer el motivo.
 */
@Injectable()
export class SuscripcionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accesoCuenta: AccesoCuentaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    // La consola de admin no pertenece a la empresa del usuario.
    if (this.reflector.getAllAndOverride<boolean>(REQUIRE_ADMIN_APP_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(PERMITIDO_SIN_SUSCRIPCION_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<Request>();
    // Registro de una empresa nueva (@SinEmpresa): todavía no hay suscripción.
    if (!request.empresa) return true;

    const acceso = await this.accesoCuenta.de(request.empresa.id);
    if (acceso.nivel !== 'solo_lectura') return true;

    if (this.reflector.getAllAndOverride<boolean>(EXPORTACION_KEY, targets) && !acceso.puedeExportar) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'cuenta_sin_exportacion',
        message: 'Tu prueba gratis terminó: para descargar tus datos contratá un plan.',
      });
    }
    if (LECTURA.has(request.method)) return true;

    throw new ForbiddenException({
      statusCode: 403,
      code: 'cuenta_solo_lectura',
      message:
        acceso.motivo === 'prueba_vencida'
          ? 'Tu prueba gratis terminó: podés ver tus datos, pero para cargar cosas nuevas contratá un plan.'
          : 'Tu plan venció: podés ver tus datos, pero para cargar cosas nuevas renová tu plan.',
    });
  }
}
