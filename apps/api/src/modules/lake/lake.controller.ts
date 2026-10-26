import { Controller, Get, Post } from '@nestjs/common';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { LakeService } from './lake.service.js';

@Controller('lake')
export class LakeController {
  constructor(private readonly lakeService: LakeService) {}

  @Get('insights')
  async obtenerInsights(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.lakeService.obtenerInsightsEmpresa(empresa.id);
  }

  @Post('recalcular')
  async recalcularInsights(@CurrentEmpresa() empresa: EmpresaContext) {
    const res = await this.lakeService.generarInsightsOcultos(empresa.id);
    return {
      ok: true,
      cantidadGenerada: res.length,
      insights: res,
    };
  }
}
