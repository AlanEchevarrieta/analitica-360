import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { TiendaService } from './tienda.service.js';
import { CuentasTiendaService } from './cuentas-tienda.js';
import { TiendaThrottlerGuard } from './tienda-throttler.guard.js';
import { crearPedidoTiendaSchema, validarCuponSchema, type CrearPedidoTiendaInput, type ValidarCuponInput } from './tienda.dto.js';

/**
 * API pública de la tienda online (sin Clerk): la consume el servidor de
 * cada tienda (ej. acacia-store) para leer el catálogo y crear pedidos con
 * origen 'tienda_online'. La empresa viaja en la URL porque no hay sesión.
 */
@Controller('tienda/:empresaId')
@Public()
@UseGuards(TiendaThrottlerGuard)
export class TiendaController {
  constructor(
    private readonly tiendaService: TiendaService,
    private readonly cuentas: CuentasTiendaService,
  ) {}

  @Get('catalogo')
  catalogo(@Param('empresaId', new ParseUUIDPipe()) empresaId: string) {
    return this.tiendaService.catalogo(empresaId);
  }

  /** Pedido mínimo y % por transferencia, para mostrarlos en el carrito y el checkout. */
  @Get('condiciones')
  condiciones(@Param('empresaId', new ParseUUIDPipe()) empresaId: string) {
    return this.tiendaService.condiciones(empresaId);
  }

  // Límite bajo: que no se puedan probar códigos a lo loco.
  @Post('cupones/validar')
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  validarCupon(
    @Param('empresaId', new ParseUUIDPipe()) empresaId: string,
    @Body(new ZodValidationPipe(validarCuponSchema)) body: ValidarCuponInput,
  ) {
    return this.tiendaService.validarCupon(empresaId, body);
  }

  // Un cliente real no confirma más de un par de pedidos por minuto.
  @Post('pedidos')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async crearPedido(
    @Param('empresaId', new ParseUUIDPipe()) empresaId: string,
    @Body(new ZodValidationPipe(crearPedidoTiendaSchema)) body: CrearPedidoTiendaInput,
    @Headers('x-sesion-tienda') sesion?: string,
  ) {
    // Con sesión, el pedido queda en "Mis pedidos" y atado al cliente; sin sesión, como invitado.
    const cuenta = await this.cuentas.cuentaOpcional(empresaId, sesion);
    return this.tiendaService.crearPedido(empresaId, body, cuenta?.clienteId ?? null);
  }
}
