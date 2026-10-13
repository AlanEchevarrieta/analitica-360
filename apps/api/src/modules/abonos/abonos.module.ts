import { Module } from '@nestjs/common';
import { VentasModule } from '../ventas/ventas.module.js';
import { AbonosController } from './abonos.controller.js';
import { AbonosService } from './abonos.service.js';

/** Abonos (módulo de servicios, pieza 4): cada cuota se cobra con VentasService. */
@Module({
  imports: [VentasModule],
  controllers: [AbonosController],
  providers: [AbonosService],
})
export class AbonosModule {}
