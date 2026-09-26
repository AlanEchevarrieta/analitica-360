import { Controller, Get } from '@nestjs/common';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import { ACCIONES, MODULOS, tieneAccion, tieneModulo } from '../../common/auth/rol.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

/**
 * Qué puede ver/hacer el usuario en la empresa activa, ya resuelto (rol +
 * permisos del colaborador). La web lo usa solo para no mostrar lo que la
 * API igual va a rechazar; la autorización real sigue en los guards.
 */
@Controller('usuarios')
export class MiAccesoController {
  @Get('yo')
  yo(@CurrentUser() usuario: UsuarioContext) {
    return {
      rol: usuario.rol,
      modulos: MODULOS.filter((m) => tieneModulo(usuario.rol, m, usuario.acceso)),
      acciones: ACCIONES.filter((a) => tieneAccion(usuario.rol, a, usuario.acceso)),
    };
  }
}
