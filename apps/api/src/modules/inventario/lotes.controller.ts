import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { LotesService } from './lotes.service.js';
import {
  crearLoteSchema,
  disponiblesQuerySchema,
  type CrearLoteInput,
  type DisponiblesQuery,
} from './inventario.dto.js';

@Controller()
@RequireModulo('inventario')
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Get('lotes/sugerencia-numero')
  sugerenciaNumero(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.lotesService.sugerenciaNumero(empresa.id).then((numeroLote) => ({ numeroLote }));
  }

  @Get('productos/:productoId/lotes')
  listar(@CurrentEmpresa() empresa: EmpresaContext, @Param('productoId') productoId: string) {
    return this.lotesService.listarPorProducto(empresa.id, productoId);
  }

  @Get('productos/:productoId/lotes/disponibles')
  disponibles(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('productoId') productoId: string,
    @Query(new ZodValidationPipe(disponiblesQuerySchema)) query: DisponiblesQuery,
  ) {
    return this.lotesService.disponibles(empresa.id, productoId, query.varianteId ?? null);
  }

  @Post('productos/:productoId/lotes')
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('productoId') productoId: string,
    @Body(new ZodValidationPipe(crearLoteSchema)) body: CrearLoteInput,
  ) {
    return this.lotesService.crear(empresa.id, usuario.id, productoId, body);
  }
}
