import { Module } from '@nestjs/common';
import { DocumentosModule } from '../documentos/documentos.module.js';
import { PresupuestosController } from './presupuestos.controller.js';
import { PresupuestosService } from './presupuestos.service.js';

/** Presupuestos (plan Pro): su PDF lo arma DocumentosService con el armador que registra este módulo. */
@Module({
  imports: [DocumentosModule],
  controllers: [PresupuestosController],
  providers: [PresupuestosService],
})
export class PresupuestosModule {}
