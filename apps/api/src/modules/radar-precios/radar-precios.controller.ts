import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { RadarPreciosService } from './radar-precios.service.js';
import type { EscaneoLoteInput, AlinearPrecioInput } from './radar-precios.types.js';

@Controller('radar-precios')
export class RadarPreciosController {
  constructor(private readonly radarPreciosService: RadarPreciosService) {}

  @Get('comparativas')
  async obtenerComparativas(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.radarPreciosService.obtenerComparativas(empresa.id);
  }

  @Post('escanear/:id')
  async escanearProducto(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.radarPreciosService.escanearProducto(empresa.id, id);
  }

  @Post('escanear-lote')
  async escanearLote(@CurrentEmpresa() empresa: EmpresaContext, @Body() body?: EscaneoLoteInput) {
    return this.radarPreciosService.escanearLote(empresa.id, body);
  }

  @Post('alinear/:id')
  async alinearPrecio(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body() body: AlinearPrecioInput,
  ) {
    return this.radarPreciosService.alinearPrecio(empresa.id, id, body.nuevoPrecio, body.motivo);
  }
}
