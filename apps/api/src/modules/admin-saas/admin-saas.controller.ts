import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminSaasService } from './admin-saas.service.js';
import { listarPagosQuerySchema, registrarPagoSchema, type ListarPagosQuery, type RegistrarPagoDto } from './admin-saas.dto.js';

/** Cross-tenant, todo gateado por @RequireAdminApp() (puerto de es_admin_app()). */
@Controller('admin')
@RequireAdminApp()
export class AdminSaasController {
  constructor(private readonly adminSaasService: AdminSaasService) {}

  @Get('metrics')
  metrics() {
    return this.adminSaasService.metrics();
  }

  @Get('capacidad')
  capacidad() {
    return this.adminSaasService.capacidad();
  }

  @Get('pagos')
  listarPagos(@Query(new ZodValidationPipe(listarPagosQuerySchema)) query: ListarPagosQuery) {
    return this.adminSaasService.listarPagos(query.estado, query.periodo);
  }

  @Post('pagos')
  registrarPago(@Body(new ZodValidationPipe(registrarPagoSchema)) body: RegistrarPagoDto) {
    return this.adminSaasService.registrarPago(body);
  }
}
