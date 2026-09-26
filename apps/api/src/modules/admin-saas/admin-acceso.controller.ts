import { Controller, Get } from '@nestjs/common';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';

/**
 * ¿Quien llama es administrador de la app? Sin @RequireAdminApp() a
 * propósito: la web lo consulta para cualquier usuario (mostrar o no la
 * consola) y un 403 ensuciaba la consola del navegador en cada pantalla. No
 * expone nada: solo responde sí o no sobre el propio usuario.
 */
@Controller('admin')
export class AdminAccesoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('yo')
  async yo(@CurrentUser() usuario: UsuarioContext) {
    const email = usuario.email?.trim();
    const admin = email ? await this.prisma.adminEmail.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { email: true } }) : null;
    return { admin: Boolean(admin) };
  }
}
