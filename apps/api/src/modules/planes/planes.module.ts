import { Module } from '@nestjs/common';
import { SuscripcionController } from './suscripcion.controller.js';
import { AdminSuscripcionController } from './admin-suscripcion.controller.js';
import { SuscripcionService } from './suscripcion.service.js';
import { SUSCRIPCION_REPOSITORY } from './suscripcion.repository.js';
import { PrismaSuscripcionRepository } from './prisma-suscripcion.repository.js';

@Module({
  controllers: [SuscripcionController, AdminSuscripcionController],
  providers: [SuscripcionService, { provide: SUSCRIPCION_REPOSITORY, useClass: PrismaSuscripcionRepository }],
})
export class PlanesModule {}
