import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminSaasService } from './admin-saas.service.js';
import { listarPagosQuerySchema, type ListarPagosQuery } from './admin-saas.dto.js';
import { CobrosService } from '../alianzas/cobros.service.js';
import { cotizarCobroSchema, devolverPagoSchema, registrarCobroSchema, type CotizarCobroDto, type RegistrarCobroDto } from '../alianzas/alianzas.dto.js';

/** Cross-tenant, todo gateado por @RequireAdminApp() (puerto de es_admin_app()). */
@Controller('admin')
@RequireAdminApp()
export class AdminSaasController {
  constructor(
    private readonly adminSaasService: AdminSaasService,
    private readonly cobros: CobrosService,
  ) {}

  @Get('metrics')
  metrics() {
    return this.adminSaasService.metrics();
  }

  /** Clientes con su plan, uso, salud y alertas. */
  @Get('empresas')
  empresas() {
    return this.adminSaasService.empresas();
  }

  @Get('empresas/:id')
  empresa(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminSaasService.empresa(id);
  }

  /** Evolución de los últimos 12 meses (sin empresas demo). */
  @Get('evolucion')
  evolucion() {
    return this.adminSaasService.evolucion();
  }

  @Get('capacidad')
  capacidad() {
    return this.adminSaasService.capacidad();
  }

  @Get('pagos')
  listarPagos(@Query(new ZodValidationPipe(listarPagosQuerySchema)) query: ListarPagosQuery) {
    return this.adminSaasService.listarPagos(query.estado, query.periodo);
  }

  /** Cuotas vencidas sin pagar de todos los clientes. */
  @Get('pagos/cuotas-vencidas')
  cuotasVencidas() {
    return this.cobros.cuotasVencidas();
  }

  /** Planes de cuotas de un cliente: pagadas, pendientes y vencidas. */
  @Get('empresas/:id/cuotas')
  cuotasDeEmpresa(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.cobros.cuotasDeEmpresa(id);
  }

  /** Cuánto cobrar: plan, ciclo y el descuento del cupón de la empresa (primer período o renovación, cuotas). */
  @Post('pagos/cotizar')
  @HttpCode(200)
  cotizarPago(@Body(new ZodValidationPipe(cotizarCobroSchema)) body: CotizarCobroDto) {
    return this.cobros.proponer(body);
  }

  /** Registra un cobro (pago completo o cuota): extiende la suscripción y genera la comisión si vino por una cámara. */
  @Post('pagos')
  registrarPago(@Body(new ZodValidationPipe(registrarCobroSchema)) body: RegistrarCobroDto) {
    return this.cobros.registrar(body);
  }

  /** Devolución: el pago queda devuelto y la comisión se ajusta en negativo. */
  @Post('pagos/:id/devolver')
  @HttpCode(200)
  devolverPago(@Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(devolverPagoSchema)) body: { motivo: string }) {
    return this.cobros.devolver(id, body.motivo);
  }
}
