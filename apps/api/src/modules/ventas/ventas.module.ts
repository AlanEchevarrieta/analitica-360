import { Module } from '@nestjs/common';
import { VentasController } from './ventas.controller.js';
import { VentasService } from './ventas.service.js';
import { VENTAS_REPOSITORY } from './ventas.repository.js';
import { PrismaVentasRepository } from './prisma-ventas.repository.js';
import { LakeModule } from '../lake/lake.module.js';

@Module({
  imports: [LakeModule],
  controllers: [VentasController],
  providers: [
    VentasService,
    { provide: VENTAS_REPOSITORY, useClass: PrismaVentasRepository },
  ],
  // Documentos arma el comprobante de venta con la misma ficha.
  exports: [VentasService],
})
export class VentasModule {}
