import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { VariantesService } from './variantes.service.js';
import { guardarVariantesProductoSchema, type GuardarVariantesProductoInput } from './variantes.dto.js';

@Controller('productos/:productoId/variantes')
@RequireModulo('productos')
export class VariantesController {
  constructor(private readonly variantesService: VariantesService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext, @Param('productoId') productoId: string) {
    return this.variantesService.listarPorProducto(empresa.id, productoId);
  }

  /** Unidades que no están en ninguna variante (hay que repartirlas al agregar variantes). */
  @Get('sin-asignar')
  sinAsignar(@CurrentEmpresa() empresa: EmpresaContext, @Param('productoId') productoId: string) {
    return this.variantesService.stockSinVariante(empresa.id, productoId);
  }

  @Put()
  @RequirePermiso('editar_productos')
  guardar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('productoId') productoId: string,
    @Body(new ZodValidationPipe(guardarVariantesProductoSchema)) body: GuardarVariantesProductoInput,
  ) {
    return this.variantesService.guardar(empresa.id, usuario.id, productoId, body);
  }
}
