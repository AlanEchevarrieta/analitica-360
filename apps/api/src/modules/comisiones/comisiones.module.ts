import { Module } from '@nestjs/common';
import { VentasModule } from '../ventas/ventas.module.js';
import { ComisionesController } from './comisiones.controller.js';
import { ComisionesService } from './comisiones.service.js';

/** Comisiones por profesional (módulo de servicios, pieza 5). */
@Module({
  imports: [VentasModule],
  controllers: [ComisionesController],
  providers: [ComisionesService],
})
export class ComisionesModule {}
