import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { VentasService } from './ventas.service.js';
import {
  anularVentaSchema,
  cobrarSaldoVentaSchema,
  confirmarVentaSchema,
  listarVentasQuerySchema,
  type AnularVentaInput,
  type CobrarSaldoVentaInput,
  type ConfirmarVentaInput,
  type ListarVentasQuery,
} from './ventas.dto.js';

@Controller('ventas')
@RequireModulo('ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(listarVentasQuerySchema)) query: ListarVentasQuery,
  ) {
    return this.ventasService.listar(empresa.id, query);
  }

  @Get('rango')
  rango(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.ventasService.rango(empresa.id);
  }

  @Get(':id')
  ficha(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.ventasService.ficha(empresa.id, id);
  }

  @Post()
  @RequirePermiso('registrar_ventas')
  confirmar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(confirmarVentaSchema)) body: ConfirmarVentaInput,
  ) {
    return this.ventasService.confirmar(empresa.id, usuario.id, body);
  }

  @Post(':id/anular')
  @RequirePermiso('anular_ventas')
  anular(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(anularVentaSchema)) body: AnularVentaInput,
  ) {
    return this.ventasService.anular(empresa.id, usuario.id, id, body);
  }

  @Post(':id/cobrar-saldo')
  cobrarSaldo(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cobrarSaldoVentaSchema)) body: CobrarSaldoVentaInput,
  ) {
    return this.ventasService.cobrarSaldo(empresa.id, id, body);
  }
}
