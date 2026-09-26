import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { KardexService } from './kardex.service.js';
import { MovimientosService } from './movimientos.service.js';
import {
  kardexQuerySchema,
  kardexValorizadoQuerySchema,
  periodoQuerySchema,
  registrarAjusteSchema,
  registrarTrasladoMasivoSchema,
  registrarTrasladoSchema,
  type KardexQuery,
  type KardexValorizadoQuery,
  type PeriodoQuery,
  type RegistrarAjusteInput,
  type RegistrarTrasladoInput,
  type RegistrarTrasladoMasivoInput,
} from './inventario.dto.js';

@Controller()
@RequireModulo('inventario')
export class MovimientosController {
  constructor(
    private readonly movimientosService: MovimientosService,
    private readonly kardexService: KardexService,
  ) {}

  /** Kardex valorizado (PPP) de un producto en un período. */
  @Get('inventario/kardex/:productoId')
  @RequirePermiso('ver_costos')
  kardexValorizado(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('productoId', ParseUUIDPipe) productoId: string,
    @Query(new ZodValidationPipe(kardexValorizadoQuerySchema)) q: KardexValorizadoQuery,
  ) {
    return this.kardexService.kardex(empresa.id, productoId, q.desde, q.hasta, q.varianteId ?? null);
  }

  /** Mermas, roturas, pérdidas y consumo interno valuados, por tipo y por producto. */
  @Get('inventario/perdidas')
  @RequirePermiso('ver_costos')
  perdidas(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(periodoQuerySchema)) q: PeriodoQuery) {
    return this.kardexService.perdidas(empresa.id, q.desde, q.hasta);
  }

  @Get('productos/:productoId/movimientos')
  kardex(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('productoId') productoId: string,
    @Query(new ZodValidationPipe(kardexQuerySchema)) query: KardexQuery,
  ) {
    return this.movimientosService.listarKardex(empresa.id, productoId, query);
  }

  @Post('inventario/movimientos/ajuste')
  registrarAjuste(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(registrarAjusteSchema)) body: RegistrarAjusteInput,
  ) {
    return this.movimientosService.registrarAjuste(empresa.id, usuario.id, body);
  }

  @Post('inventario/traslados')
  registrarTraslado(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(registrarTrasladoSchema)) body: RegistrarTrasladoInput,
  ) {
    return this.movimientosService.registrarTraslado(empresa.id, usuario.id, body);
  }

  @Post('inventario/traslados/masivo')
  registrarTrasladoMasivo(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(registrarTrasladoMasivoSchema)) body: RegistrarTrasladoMasivoInput,
  ) {
    return this.movimientosService.registrarTrasladoMasivo(empresa.id, usuario.id, body);
  }
}
