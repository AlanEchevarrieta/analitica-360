import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PermitidoSinSuscripcion } from '../../common/decorators/suscripcion.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { eventosUsoSchema, usoQuerySchema, type EventosUsoDto, type UsoQuery } from './uso.dto.js';
import { UsoService } from './uso.service.js';

/** La web manda en lotes las pantallas que se abren y los botones que se tocan. */
@Controller('uso')
export class UsoController {
  constructor(private readonly uso: UsoService) {}

  @Post('eventos')
  @HttpCode(204)
  @PermitidoSinSuscripcion()
  async registrar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(eventosUsoSchema)) dto: EventosUsoDto) {
    await this.uso.registrar(empresa.id, usuario.id, dto);
  }
}

/** Consola → Uso: solo el administrador de la app. */
@Controller('admin/uso')
@RequireAdminApp()
export class UsoAdminController {
  constructor(private readonly uso: UsoService) {}

  @Get()
  resumen(@Query(new ZodValidationPipe(usoQuerySchema)) q: UsoQuery) {
    return this.uso.resumen(q);
  }

  @Get('usuarios/:id')
  usuario(@Param('id', new ParseUUIDPipe()) id: string, @Query(new ZodValidationPipe(usoQuerySchema)) q: UsoQuery) {
    return this.uso.usuario(id, q);
  }
}
