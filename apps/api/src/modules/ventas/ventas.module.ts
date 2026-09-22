import { Module } from '@nestjs/common';
import { VentasController } from './ventas.controller.js';
import { VentasService } from './ventas.service.js';
import { VENTAS_REPOSITORY } from './ventas.repository.js';
import { PrismaVentasRepository } from './prisma-ventas.repository.js';

@Module({
  controllers: [VentasController],
  providers: [
    VentasService,
    { provide: VENTAS_REPOSITORY, useClass: PrismaVentasRepository },
  ],
})
export class VentasModule {}
