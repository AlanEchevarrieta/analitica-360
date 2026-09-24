import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SuscripcionService } from './suscripcion.service.js';
import {
  asignarSuscripcionSchema,
  cambiarEstadoSuscripcionSchema,
  marcarDemoSchema,
  type AsignarSuscripcionDto,
  type CambiarEstadoSuscripcionDto,
  type MarcarDemoDto,
} from './suscripcion.dto.js';

/** Cross-tenant, todo gateado por @RequireAdminApp() (puerto de es_admin_app()). */
@Controller('admin')
@RequireAdminApp()
export class AdminSuscripcionController {
  constructor(private readonly suscripcionService: SuscripcionService) {}

  @Get('planes')
  listarPlanes() {
    return this.suscripcionService.listarPlanes();
  }

  @Get('suscripciones')
  listarSuscripciones() {
    return this.suscripcionService.listarSuscripciones();
  }

  @Patch('empresas/:id/demo')
  @HttpCode(204)
  async marcarDemo(@Param('id') id: string, @Body(new ZodValidationPipe(marcarDemoSchema)) body: MarcarDemoDto) {
    await this.suscripcionService.marcarEmpresaDemo(id, body.esDemo);
  }

  @Post('suscripciones/asignar')
  @HttpCode(204)
  async asignar(@Body(new ZodValidationPipe(asignarSuscripcionSchema)) body: AsignarSuscripcionDto) {
    await this.suscripcionService.asignarSuscripcion(body.empresaId, body.planId, body.fechaVencimiento);
  }

  @Patch('suscripciones/:id/estado')
  @HttpCode(204)
  async cambiarEstado(@Param('id') id: string, @Body(new ZodValidationPipe(cambiarEstadoSuscripcionSchema)) body: CambiarEstadoSuscripcionDto) {
    await this.suscripcionService.cambiarEstadoSuscripcion(id, body.estado);
  }
}
