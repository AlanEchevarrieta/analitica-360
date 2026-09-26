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
  skuProductoSchema,
  type SkuProductoInput,
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

  /** Escaneo / búsqueda exacta: código de barras o SKU (de producto o variante). */
  @Get('por-codigo/:codigo')
  buscarPorCodigo(@CurrentEmpresa() empresa: EmpresaContext, @Param('codigo') codigo: string) {
    return this.productosService.buscarPorCodigo(empresa.id, codigo);
  }

  /** Genera el SKU de todos los productos y variantes que no tienen. */
  @Post('sku/asignar')
  @RequirePermiso('editar_productos')
  async asignarSku(@CurrentEmpresa() empresa: EmpresaContext) {
    return { asignados: await this.productosService.asignarSkuFaltantes(empresa.id) };
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

  @Patch(':id/sku')
  @RequirePermiso('editar_productos')
  guardarSku(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(skuProductoSchema)) body: SkuProductoInput,
  ) {
    return this.productosService.guardarSku(empresa.id, id, body.sku);
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
