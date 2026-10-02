import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AlianzasAdminService } from './alianzas-admin.service.js';
import { CobrosService } from './cobros.service.js';
import {
  aprobarLiquidacionSchema,
  camaraParcialSchema,
  camaraSchema,
  cuponParcialSchema,
  cuponSchema,
  cuotasGeneralesSchema,
  liquidacionQuerySchema,
  origenSchema,
  pagarLiquidacionSchema,
  type CamaraDto,
  type CuponDto,
  type OrigenDto,
} from './alianzas.dto.js';

/** Consola: cámaras, cupones, comisiones y liquidaciones. Solo admin (el emprendedor nunca ve comisiones). */
@Controller('admin/alianzas')
@RequireAdminApp()
export class AlianzasAdminController {
  constructor(
    private readonly service: AlianzasAdminService,
    private readonly cobros: CobrosService,
  ) {}

  /** Cuotas sin interés para quien no tiene código, por plan. */
  @Get('cuotas')
  cuotasGenerales() {
    return this.cobros.listarCuotasGenerales();
  }

  @Patch('cuotas/:id')
  editarCuotasGenerales(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(cuotasGeneralesSchema)) body: { trimestral?: number; anual?: number }) {
    return this.cobros.editarCuotasGenerales(id, body);
  }

  @Get('resumen')
  resumen() {
    return this.service.resumen();
  }

  @Get('camaras')
  camaras() {
    return this.service.listarCamaras();
  }

  @Post('camaras')
  crearCamara(@Body(new ZodValidationPipe(camaraSchema)) body: CamaraDto) {
    return this.service.crearCamara(body);
  }

  @Get('camaras/:id')
  camara(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.fichaCamara(id);
  }

  @Patch('camaras/:id')
  editarCamara(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(camaraParcialSchema)) body: Partial<CamaraDto>) {
    return this.service.editarCamara(id, body);
  }

  @Get('camaras/:id/meses')
  meses(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.mesesLiquidables(id);
  }

  @Get('cupones')
  cupones() {
    return this.service.listarCupones();
  }

  @Post('cupones')
  crearCupon(@Body(new ZodValidationPipe(cuponSchema)) body: CuponDto) {
    return this.service.crearCupon(body);
  }

  @Patch('cupones/:id')
  editarCupon(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(cuponParcialSchema)) body: Partial<CuponDto>) {
    return this.service.editarCupon(id, body);
  }

  @Get('liquidaciones')
  liquidacion(@Query(new ZodValidationPipe(liquidacionQuerySchema)) q: { camaraId: string; mes: string }) {
    return this.service.liquidacion(q.camaraId, q.mes);
  }

  @Post('liquidaciones/aprobar')
  @HttpCode(200)
  aprobar(@Body(new ZodValidationPipe(aprobarLiquidacionSchema)) body: { camaraId: string; mes: string }, @CurrentUser() usuario: UsuarioContext) {
    return this.service.aprobarLiquidacion(body.camaraId, body.mes, usuario.email);
  }

  @Post('liquidaciones/:id/pagar')
  @HttpCode(200)
  pagar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(pagarLiquidacionSchema)) body: { fecha: string; referencia: string }) {
    return this.service.pagarLiquidacion(id, body.fecha, body.referencia);
  }

  @Get('empresas/:id/origen')
  origen(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.origen(id);
  }

  @Patch('empresas/:id/origen')
  cambiarOrigen(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(origenSchema)) body: OrigenDto, @CurrentUser() usuario: UsuarioContext) {
    return this.service.cambiarOrigen(id, body, usuario.email);
  }
}
