import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { FORMAS_PAGO } from '../ventas/ventas.util.js';
import { CuentaCorrienteService } from './cuenta-corriente.service.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';

const cobroSchema = z.object({
  monto: z.number().positive('El monto tiene que ser mayor a 0'),
  formaPago: z.enum(FORMAS_PAGO),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  notas: z.string().trim().max(300).nullable().default(null),
});

/** Cuenta corriente de clientes: quién debe, resumen de cuenta y cobros. */
@Controller('cuenta-corriente')
@RequireFuncion('cuenta_corriente')
@RequireModulo('clientes')
export class CuentaCorrienteController {
  constructor(private readonly service: CuentaCorrienteService) {}

  @Get()
  resumen(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.service.resumen(empresa.id);
  }

  @Get(':clienteId')
  cuenta(@CurrentEmpresa() empresa: EmpresaContext, @Param('clienteId', ParseUUIDPipe) clienteId: string) {
    return this.service.cuenta(empresa.id, clienteId);
  }

  @Post(':clienteId/cobros')
  @RequirePermiso('registrar_ventas')
  cobrar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('clienteId', ParseUUIDPipe) clienteId: string,
    @Body(new ZodValidationPipe(cobroSchema)) body: z.infer<typeof cobroSchema>,
  ) {
    // Mediodía de Argentina: la fecha elegida no se corre de día por la zona horaria.
    return this.service.cobrar(empresa.id, clienteId, usuario.id, { ...body, fecha: new Date(`${body.fecha}T15:00:00Z`) });
  }

  @Post('cobros/:id/anular')
  @HttpCode(200)
  @RequirePermiso('anular_ventas')
  anular(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.anularCobro(empresa.id, id);
  }
}
