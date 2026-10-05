import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { ContabilidadModule } from '../contabilidad/contabilidad.module.js';
import { CuentaCorrienteModule } from '../cuenta-corriente/cuenta-corriente.module.js';
import { PlanesModule } from '../planes/planes.module.js';
import { InformesController } from './informes.controller.js';
import { InformesDatosService } from './informes-datos.service.js';
import { InformesProgramador } from './informes.programador.js';
import { InformesService } from './informes.service.js';

@Module({
  imports: [AnalyticsModule, ContabilidadModule, CuentaCorrienteModule, PlanesModule],
  controllers: [InformesController],
  providers: [InformesDatosService, InformesService, InformesProgramador],
})
export class InformesModule {}
