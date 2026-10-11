import { Module } from '@nestjs/common';
import { SuscripcionController } from './suscripcion.controller.js';
import { AdminSuscripcionController } from './admin-suscripcion.controller.js';
import { SuscripcionService } from './suscripcion.service.js';
import { AccesoCuentaService } from './acceso-cuenta.service.js';
import { SUSCRIPCION_REPOSITORY } from './suscripcion.repository.js';
import { PrismaSuscripcionRepository } from './prisma-suscripcion.repository.js';
import { BcraInflacionClient } from '../analytics/bcra-inflacion.client.js';
import { AdminPreciosController, PreciosPublicosController } from './precios-plan.controller.js';
import { PreciosPlanProgramador } from './precios-plan.programador.js';
import { PreciosPlanService } from './precios-plan.service.js';

@Module({
  controllers: [SuscripcionController, AdminSuscripcionController, PreciosPublicosController, AdminPreciosController],
  providers: [
    SuscripcionService,
    AccesoCuentaService,
    { provide: SUSCRIPCION_REPOSITORY, useClass: PrismaSuscripcionRepository },
    PreciosPlanService,
    PreciosPlanProgramador,
    BcraInflacionClient,
  ],
  // SuscripcionGuard (AuthModule) lo usa en cada request; el cobro, los precios vigentes.
  exports: [AccesoCuentaService, PreciosPlanService],
})
export class PlanesModule {}
