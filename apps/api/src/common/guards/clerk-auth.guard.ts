import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { Env } from '../../config/env.validation.js';

/**
 * Guard global (APP_GUARD). Valida el JWT de sesión de Clerk (header
 * `Authorization: Bearer <token>`) contra el JWKS de la instancia, usando
 * CLERK_SECRET_KEY. Deja `request.clerkAuth` seteado para que
 * EmpresaScopeGuard resuelva el usuario/empresa interno a continuación.
 *
 * No hace autorización por sí mismo más allá de "el token es válido" — el
 * multi-tenancy (empresa) y los roles/permisos son guards separados
 * (EmpresaScopeGuard, RolesGuard, PermissionsGuard) para poder componerlos
 * por endpoint.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el header Authorization: Bearer <token>');
    }
    const token = authHeader.slice('Bearer '.length);

    try {
      const claims = await verifyToken(token, {
        secretKey: this.config.get('CLERK_SECRET_KEY', { infer: true }),
      });
      request.clerkAuth = {
        clerkUserId: claims.sub,
        clerkOrgId: (claims.org_id as string | undefined) ?? null,
        sessionClaims: claims as unknown as Record<string, unknown>,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token de sesión de Clerk inválido o expirado');
    }
  }
}
