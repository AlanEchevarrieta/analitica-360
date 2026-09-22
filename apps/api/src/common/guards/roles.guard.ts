import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { Rol } from '../auth/rol.types.js';

/** Corre después de EmpresaScopeGuard (necesita request.usuario ya resuelto). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const rolesRequeridos = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rolesRequeridos || rolesRequeridos.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const rol = request.usuario?.rol;
    if (!rol || !rolesRequeridos.includes(rol)) {
      throw new ForbiddenException(
        `Requiere rol ${rolesRequeridos.join(' o ')}, el usuario tiene rol '${rol ?? 'desconocido'}'`,
      );
    }
    return true;
  }
}
