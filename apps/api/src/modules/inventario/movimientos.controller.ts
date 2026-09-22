import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MovimientosService } from './movimientos.service.js';
import {
  kardexQuerySchema,
  registrarAjusteSchema,
  registrarTrasladoMasivoSchema,
  registrarTrasladoSchema,
  type KardexQuery,
  type RegistrarAjusteInput,
  type RegistrarTrasladoInput,
  type RegistrarTrasladoMasivoInput,
} from './inventario.dto.js';

@Controller()
@RequireModulo('inventario')
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

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
