import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { GastoService } from './gasto.service.js';
import {
  cambiarMontoGastoSchema,
  crearGastoSchema,
  dejarDeRepetirSchema,
  editarGastoSchema,
  listarGastosQuerySchema,
  tipoCostoSchema,
  type CambiarMontoGastoDto,
  type CrearGastoDto,
  type DejarDeRepetirDto,
  type EditarGastoDto,
  type ListarGastosQuery,
  type TipoCostoDto,
} from './gasto.dto.js';

@Controller('gastos')
@RequireModulo('contabilidad')
export class GastoController {
  constructor(private readonly gastoService: GastoService) {}

  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(listarGastosQuerySchema)) query: ListarGastosQuery,
  ) {
    return this.gastoService.listar(empresa.id, query.desde, query.hasta, query.categoria as never);
  }

  @Post()
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(crearGastoSchema)) body: CrearGastoDto,
  ) {
    return this.gastoService.crear(empresa.id, usuario.id, body);
  }

  /** Editar descripción, categoría, monto o fecha de inicio (para corregir errores de carga). */
  @Patch(':id')
  editar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(editarGastoSchema)) body: EditarGastoDto,
  ) {
    return this.gastoService.editar(empresa.id, id, body);
  }

  /** Fijo o variable (para el punto de equilibrio). */
  @Patch(':id/tipo-costo')
  @HttpCode(204)
  async tipoCosto(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(tipoCostoSchema)) body: TipoCostoDto,
  ) {
    await this.gastoService.cambiarTipoCosto(empresa.id, id, body.tipoCosto);
  }

  /** Dejar de repetir un gasto recurrente desde una fecha (fechaFin = desde - 1 día), conservando la historia previa. */
  @Post(':id/dejar-de-repetir')
  dejarDeRepetir(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dejarDeRepetirSchema)) body: DejarDeRepetirDto,
  ) {
    return this.gastoService.dejarDeRepetir(empresa.id, id, body.desde);
  }

  /** Cambiar el monto de un recurrente desde una fecha: corta el anterior el día previo y crea uno nuevo. */
  @Post(':id/cambiar-monto')
  cambiarMontoDesde(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cambiarMontoGastoSchema)) body: CambiarMontoGastoDto,
  ) {
    return this.gastoService.cambiarMontoDesde(empresa.id, usuario.id, id, body);
  }

  @Post(':id/anular')
  @HttpCode(204)
  async anular(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    await this.gastoService.anular(empresa.id, id);
  }
}
