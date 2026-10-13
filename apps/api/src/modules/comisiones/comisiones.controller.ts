import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ComisionesService, type PagoComisionInput } from './comisiones.service.js';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)');
const rangoSchema = z.object({ desde: fecha, hasta: fecha });
type Rango = z.infer<typeof rangoSchema>;
const pagoSchema = z.object({
  recursoId: z.uuid(),
  desde: fecha,
  hasta: fecha,
  monto: z.number().positive('El monto tiene que ser mayor a $0').max(100_000_000),
  registrarGasto: z.boolean().default(true),
  nota: z.string().trim().max(200).nullable().optional(),
});
const asignarSchema = z.object({ profesionalId: z.uuid().nullable() });

/** Comisiones (plan Pro). La liquidación de todos: el dueño y el contador; cada profesional ve la suya. */
@Controller('comisiones')
@RequireFuncion('comisiones')
export class ComisionesController {
  constructor(private readonly comisiones: ComisionesService) {}

  @Get()
  @Roles('dueno', 'contador')
  liquidacion(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(rangoSchema)) q: Rango) {
    return this.comisiones.liquidacion(empresa.id, q.desde, q.hasta);
  }

  @Get('mias')
  mias(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Query(new ZodValidationPipe(rangoSchema)) q: Rango) {
    return this.comisiones.mias(empresa.id, usuario.id, q.desde, q.hasta);
  }

  @Get('sin-asignar')
  @Roles('dueno')
  sinAsignar(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(rangoSchema)) q: Rango) {
    return this.comisiones.sinAsignar(empresa.id, q.desde, q.hasta);
  }

  @Put('ventas/:ventaId')
  @Roles('dueno')
  async asignar(@CurrentEmpresa() empresa: EmpresaContext, @Param('ventaId', new ParseUUIDPipe()) ventaId: string, @Body(new ZodValidationPipe(asignarSchema)) body: z.infer<typeof asignarSchema>) {
    await this.comisiones.asignar(empresa.id, ventaId, body.profesionalId);
    return { ok: true };
  }

  @Post('pagos')
  @Roles('dueno')
  pagar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(pagoSchema)) body: PagoComisionInput) {
    return this.comisiones.pagar(empresa.id, usuario.id, body);
  }

  @Delete('pagos/:id')
  @Roles('dueno')
  anularPago(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.comisiones.anularPago(empresa.id, id);
  }
}
