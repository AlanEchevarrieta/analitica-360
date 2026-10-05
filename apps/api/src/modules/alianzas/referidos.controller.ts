import { Controller, Get } from '@nestjs/common';
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
