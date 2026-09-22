import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { PERMISO_ACCION_KEY, PERMISO_MODULO_KEY } from '../decorators/permiso.decorator.js';
import { tieneAccion, tieneModulo, type AccionClave, type ModuloClave } from '../auth/rol.types.js';

/**
 * Corre después de EmpresaScopeGuard/RolesGuard. Replica tieneModulo()/
 * tieneAccion() del legacy (src/lib/permisos.ts). Para rol 'operador', hoy
 * depende de `request.usuario.acceso` (TODO Fase 3: persistencia real de
 * colaborador_permisos) — sin ese dato, un operador no pasa ningún check de
 * permiso granular (fail-closed, no fail-open).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const usuario = request.usuario;

    const moduloRequerido = this.reflector.getAllAndOverride<ModuloClave | undefined>(PERMISO_MODULO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (moduloRequerido && !tieneModulo(usuario?.rol ?? 'operador', moduloRequerido, usuario?.acceso)) {
      throw new ForbiddenException(`No tenés acceso al módulo '${moduloRequerido}'`);
    }

    const accionRequerida = this.reflector.getAllAndOverride<AccionClave | undefined>(PERMISO_ACCION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (accionRequerida && !tieneAccion(usuario?.rol ?? 'operador', accionRequerida, usuario?.acceso)) {
      throw new ForbiddenException(`No tenés permiso para la acción '${accionRequerida}'`);
    }

    return true;
  }
}
