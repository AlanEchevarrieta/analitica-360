import { Controller, Get } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { NotificacionesService } from './notificaciones.service.js';

/**
 * Sin @RequireModulo: los conteos de notificaciones cruzan varios dominios
 * (soporte/pedidos/inventario) y no exponen datos sensibles, solo números -
 * cualquier usuario autenticado de la empresa puede pedirlos, igual que la
 * RPC real (que tampoco filtra por rol). Mismo patrón que
 * UsuariosController: guardas de auth/empresa sin gate de módulo puntual.
 */
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get('conteos')
  conteos(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.notificacionesService.contar(empresa.id);
  }
}
