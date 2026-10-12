import { Module } from '@nestjs/common';
import { DocumentosModule } from '../documentos/documentos.module.js';
import { VentasModule } from '../ventas/ventas.module.js';
import { OrdenesTrabajoController } from './ordenes-trabajo.controller.js';
import { OrdenesTrabajoService } from './ordenes-trabajo.service.js';

/** Órdenes de trabajo (módulo de servicios, pieza 2): la venta se arma con VentasService al entregar. */
@Module({
  imports: [VentasModule, DocumentosModule],
  controllers: [OrdenesTrabajoController],
  providers: [OrdenesTrabajoService],
})
export class OrdenesTrabajoModule {}
