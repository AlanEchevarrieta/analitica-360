import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AgendaOnlineService, type ReservaOnlineInput } from '../agenda/agenda-online.service.js';
import { TiendaService } from './tienda.service.js';
import { CuentasTiendaService } from './cuentas-tienda.js';
import { TiendaThrottlerGuard } from './tienda-throttler.guard.js';
import { cotizarEnvioTiendaSchema, crearPedidoTiendaSchema, validarCuponSchema, type CotizarEnvioTiendaInput, type CrearPedidoTiendaInput, type ValidarCuponInput } from './tienda.dto.js';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');
const libresSchema = z.object({ fecha, servicioId: z.uuid(), recursoId: z.uuid().optional() });
const reservaSchema = z.object({
  servicioId: z.uuid(),
  recursoId: z.uuid().nullable().optional(),
  fecha,
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida'),
  nombre: z.string().trim().min(2, 'Poné tu nombre').max(120),
  telefono: z.string().trim().min(6, 'Poné un teléfono para avisarte').max(40),
  notas: z.string().trim().max(500).nullable().optional(),
});

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
    private readonly turnos: AgendaOnlineService,
  ) {}

  /** Reserva de turnos: servicios y profesionales que se ofrecen online ({ activa: false } si no hay). */
  @Get('turnos')
  opcionesTurnos(@Param('empresaId', new ParseUUIDPipe()) empresaId: string) {
    return this.turnos.opciones(empresaId);
  }

  @Get('turnos/libres')
  turnosLibres(@Param('empresaId', new ParseUUIDPipe()) empresaId: string, @Query(new ZodValidationPipe(libresSchema)) q: z.infer<typeof libresSchema>) {
    return this.turnos.libres(empresaId, q.fecha, q.servicioId, q.recursoId);
  }

  // Como los pedidos: una persona real no reserva más de un par de turnos por minuto.
  @Post('turnos')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async reservarTurno(
    @Param('empresaId', new ParseUUIDPipe()) empresaId: string,
    @Body(new ZodValidationPipe(reservaSchema)) body: ReservaOnlineInput,
    @Headers('x-sesion-tienda') sesion?: string,
  ) {
    const cuenta = await this.cuentas.cuentaOpcional(empresaId, sesion);
    return this.turnos.reservar(empresaId, body, cuenta?.clienteId ?? null);
  }

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

  // Cada cotización consulta a Zipnova: límite moderado.
  @Post('envios/cotizar')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  cotizarEnvio(
    @Param('empresaId', new ParseUUIDPipe()) empresaId: string,
    @Body(new ZodValidationPipe(cotizarEnvioTiendaSchema)) body: CotizarEnvioTiendaInput,
  ) {
    return this.tiendaService.cotizarEnvio(empresaId, body);
  }

  /** Pagar (o reintentar el pago de) un pedido con Mercado Pago. El id del pedido no se puede adivinar. */
  @Post('pedidos/:pedidoId/pago')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  pagarPedido(@Param('empresaId', new ParseUUIDPipe()) empresaId: string, @Param('pedidoId', new ParseUUIDPipe()) pedidoId: string) {
    return this.tiendaService.pagarPedido(empresaId, pedidoId);
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
