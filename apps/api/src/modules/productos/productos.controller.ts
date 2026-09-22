import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ProductosService } from './productos.service.js';
import {
  codigoBarraProductoSchema,
  dimensionesProductoSchema,
  guardarProductoSchema,
  listarProductosQuerySchema,
  type CodigoBarraProductoInput,
  type DimensionesProductoInput,
  type GuardarProductoInput,
  type ListarProductosQuery,
} from './productos.dto.js';

@Controller('productos')
@RequireModulo('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(listarProductosQuerySchema)) query: ListarProductosQuery,
  ) {
    return this.productosService.listar(empresa.id, query);
  }

  @Get('nombres')
  listarNombres(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.productosService.listarNombres(empresa.id);
  }

  @Get(':id')
  buscarPorId(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.productosService.buscarPorId(empresa.id, id);
  }

  @Post()
  @RequirePermiso('editar_productos')
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body(new ZodValidationPipe(guardarProductoSchema)) body: GuardarProductoInput,
  ) {
    return this.productosService.crear(empresa.id, body);
  }

  @Patch(':id')
  @RequirePermiso('editar_productos')
  actualizar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(guardarProductoSchema)) body: GuardarProductoInput,
  ) {
    return this.productosService.actualizar(empresa.id, id, body);
  }

  @Patch(':id/codigo-barra')
  @RequirePermiso('editar_productos')
  guardarCodigoBarra(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(codigoBarraProductoSchema)) body: CodigoBarraProductoInput,
  ) {
    return this.productosService.guardarCodigoBarra(empresa.id, id, body.codigoBarra);
  }

  @Patch(':id/dimensiones')
  @RequirePermiso('editar_productos')
  guardarDimensiones(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dimensionesProductoSchema)) body: DimensionesProductoInput,
  ) {
    return this.productosService.guardarDimensiones(empresa.id, id, body);
  }
}
