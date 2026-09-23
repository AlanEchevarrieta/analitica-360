import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { GastoService } from './gasto.service.js';
import { crearGastoSchema, listarGastosQuerySchema, type CrearGastoDto, type ListarGastosQuery } from './gasto.dto.js';

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

  @Post(':id/anular')
  @HttpCode(204)
  async anular(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    await this.gastoService.anular(empresa.id, id);
  }
}
