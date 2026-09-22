import { Module } from '@nestjs/common';
import { DevolucionesController } from './devoluciones.controller.js';
import { DevolucionesService } from './devoluciones.service.js';
import { DEVOLUCIONES_REPOSITORY } from './devoluciones.repository.js';
import { PrismaDevolucionesRepository } from './prisma-devoluciones.repository.js';

@Module({
  controllers: [DevolucionesController],
  providers: [
    DevolucionesService,
    { provide: DEVOLUCIONES_REPOSITORY, useClass: PrismaDevolucionesRepository },
  ],
})
export class DevolucionesModule {}
