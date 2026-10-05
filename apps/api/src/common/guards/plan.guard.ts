import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRE_ADMIN_APP_KEY } from '../decorators/admin-app.decorator.js';
import { FUNCION_PLAN_KEY } from '../decorators/funcion.decorator.js';
import { PERMISO_MODULO_KEY } from '../decorators/permiso.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AccesoCuentaService } from '../../modules/planes/acceso-cuenta.service.js';
import { PLANES, planMinimoParaModulo } from '../../modules/planes/planes.util.js';

/** Módulos que no dependen del plan: siempre se puede configurar la cuenta. */
const SIN_PLAN = new Set(['configuracion']);

/**
 * Lo que el plan contratado no incluye, no se puede usar (aunque se llame a la
 * API a mano). Corre después de SuscripcionGuard. Responde 403 con
 * code 'plan_insuficiente' y el plan mínimo, para que la web ofrezca mejorar.
 * También aplica el límite de usuarios: los que quedan afuera del plan, 403.
 */
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly acceso: AccesoCuentaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(REQUIRE_ADMIN_APP_KEY, targets)) return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.empresa || !request.usuario) return true;

    const plan = await this.acceso.planDe(request.empresa.id);
    if (!plan.usuariosHabilitados.has(request.usuario.id)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'plan_limite_usuarios',
        message: `El plan ${PLANES[plan.plan].nombre} permite ${plan.maxUsuarios} usuarios y la cuenta tiene ${plan.usuariosTotales}. Pedile al dueño que pase a un plan con más usuarios.`,
      });
    }

    const funcion =
      this.reflector.getAllAndOverride<string | undefined>(FUNCION_PLAN_KEY, targets) ??
      this.reflector.getAllAndOverride<string | undefined>(PERMISO_MODULO_KEY, targets);
    if (!funcion || SIN_PLAN.has(funcion) || plan.funciones.includes(funcion)) return true;
    const minimo = planMinimoParaModulo(funcion);
    throw new ForbiddenException({
      statusCode: 403,
      code: 'plan_insuficiente',
      funcion,
      planMinimo: minimo,
      message: `Esto está disponible desde el plan ${PLANES[minimo].nombre}.`,
    });
  }
}
