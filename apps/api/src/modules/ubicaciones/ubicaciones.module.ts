import { Module } from '@nestjs/common';
import { UbicacionesController } from './ubicaciones.controller.js';
import { UbicacionesService } from './ubicaciones.service.js';
import { UBICACIONES_REPOSITORY } from './ubicaciones.repository.js';
import { PrismaUbicacionesRepository } from './prisma-ubicaciones.repository.js';

@Module({
  controllers: [UbicacionesController],
  providers: [
    UbicacionesService,
    { provide: UBICACIONES_REPOSITORY, useClass: PrismaUbicacionesRepository },
  ],
  exports: [UBICACIONES_REPOSITORY],
})
export class UbicacionesModule {}
