import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ComprasService } from './compras.service.js';
import {
  anularCompraSchema,
  confirmarCompraSchema,
  listarComprasQuerySchema,
  type AnularCompraInput,
  type ConfirmarCompraInput,
  type ListarComprasQuery,
} from './compras.dto.js';

@Controller('compras')
@RequireModulo('compras')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(listarComprasQuerySchema)) query: ListarComprasQuery,
  ) {
    return this.comprasService.listar(empresa.id, query);
  }

  @Get(':id')
  ficha(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.comprasService.ficha(empresa.id, id);
  }

  @Post()
  confirmar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(confirmarCompraSchema)) body: ConfirmarCompraInput,
  ) {
    return this.comprasService.confirmar(empresa.id, usuario.id, body);
  }

  @Post(':id/anular')
  anular(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(anularCompraSchema)) body: AnularCompraInput,
  ) {
    return this.comprasService.anular(empresa.id, usuario.id, id, body);
  }
}
