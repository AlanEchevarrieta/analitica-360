import { Module } from '@nestjs/common';
import { CuentaCorrienteController } from './cuenta-corriente.controller.js';
import { CuentaCorrienteService } from './cuenta-corriente.service.js';

@Module({
  controllers: [CuentaCorrienteController],
  providers: [CuentaCorrienteService],
})
export class CuentaCorrienteModule {}
