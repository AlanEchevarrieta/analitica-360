import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PermitidoSinSuscripcion } from '../../common/decorators/suscripcion.decorator.js';
import { ReferidosService } from './referidos.service.js';

/** "Recomendá y ganá": solo el dueño (son descuentos de la suscripción). Anda aunque la cuenta esté en solo lectura. */
@Controller('referidos')
export class ReferidosController {
  constructor(private readonly referidos: ReferidosService) {}

  @Get()
  @Roles('dueno')
  @PermitidoSinSuscripcion()
  resumen(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.referidos.resumen(empresa.id);
  }
}

/** Consola: los referidos de un cliente. */
@Controller('admin/empresas/:id/referidos')
@RequireAdminApp()
export class AdminReferidosController {
  constructor(private readonly referidos: ReferidosService) {}

  @Get()
  resumen(@Param('id', ParseUUIDPipe) id: string) {
    return this.referidos.resumenAdmin(id);
  }
}
