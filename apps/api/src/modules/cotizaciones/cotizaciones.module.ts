import { Controller, Get, Global, Module } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CotizacionesService } from './cotizaciones.service.js';

/** `?moneda=USD` en los reportes que se pueden ver en dólares. */
export const monedaSchema = z.enum(['ARS', 'USD']).optional();

@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly cotizaciones: CotizacionesService) {}

  /** Qué dólar usa la empresa y cuánto vale hoy (para el botón $ / US$). */
  @Get('hoy')
  hoy(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.cotizaciones.hoy(empresa.id);
  }
}

@Global()
@Module({
  controllers: [CotizacionesController],
  providers: [CotizacionesService],
  exports: [CotizacionesService],
})
export class CotizacionesModule {}
