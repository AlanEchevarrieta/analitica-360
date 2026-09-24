import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { REQUIRE_ADMIN_APP_KEY } from '../decorators/admin-app.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';

/**
 * Corre después de EmpresaScopeGuard (necesita request.usuario.email ya
 * resuelto). No-op para rutas sin @RequireAdminApp() - la inmensa mayoría.
 * Puerto fiel de es_admin_app(): email del usuario (case-insensitive) en
 * la tabla admin_emails.
 */
@Injectable()
export class AdminAppGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const requiereAdminApp = this.reflector.getAllAndOverride<boolean>(REQUIRE_ADMIN_APP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiereAdminApp) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const email = request.usuario?.email?.trim();
    if (!email) throw new ForbiddenException('Requiere acceso de administrador de la app');

    // Comparación case-insensitive en ambos lados, fiel a lower(u.email) = lower(a.email) en es_admin_app().
    const admin = await this.prisma.adminEmail.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (!admin) throw new ForbiddenException('Requiere acceso de administrador de la app');

    return true;
  }
}
