import { Module } from '@nestjs/common';
import { VencimientosController } from './vencimientos.controller.js';
import { VencimientosProgramador } from './vencimientos.programador.js';
import { VencimientosService } from './vencimientos.service.js';

@Module({
  controllers: [VencimientosController],
  providers: [VencimientosService, VencimientosProgramador],
})
export class VencimientosModule {}
