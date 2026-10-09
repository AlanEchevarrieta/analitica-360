import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { MpTiendaService } from './mp-tienda.service.js';

/** Configuración → Cobros con Mercado Pago (la cuenta del comercio, para la tienda online). */
@Controller('mercadopago/tienda')
@RequireModulo('pedidos')
export class MpTiendaController {
  constructor(private readonly servicio: MpTiendaService) {}

  @Get()
  estado(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.servicio.estado(empresa.id);
  }

  @Post('conectar')
  @HttpCode(200)
  conectar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext) {
    return this.servicio.urlConectar(empresa.id, usuario);
  }

  @Delete()
  @HttpCode(204)
  async desconectar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext) {
    await this.servicio.desconectar(empresa.id, usuario);
  }
}

/** Vuelta de la autorización en Mercado Pago (el navegador del dueño, sin sesión de la API: la valida el `state` cifrado). */
@Controller('mercadopago/tienda/vuelta')
@Public()
export class MpTiendaVueltaController {
  constructor(private readonly servicio: MpTiendaService) {}

  @Get()
  async vuelta(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Query('error') error: string | undefined, @Res() res: Response) {
    res.redirect(302, await this.servicio.vuelta(code, state, error));
  }
}

/** Avisos de pagos de las tiendas (la clave de la URL dice de qué comercio es). */
@Controller('webhooks/mercadopago-tienda')
@Public()
export class AvisosMpTiendaController {
  constructor(private readonly servicio: MpTiendaService) {}

  @Post(':clave')
  @HttpCode(200)
  async aviso(@Param('clave') clave: string, @Query() query: Record<string, unknown>, @Body() cuerpo: unknown) {
    if (!/^[\w-]{20,64}$/.test(clave) || !(await this.servicio.aviso(clave, query, cuerpo))) throw new NotFoundException();
    return { ok: true };
  }
}
