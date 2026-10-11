import { Module } from '@nestjs/common';
import { VentasModule } from '../ventas/ventas.module.js';
import { DocumentosController } from './documentos.controller.js';
import { DocumentosService } from './documentos.service.js';

/** Comprobante de venta, recibo y presupuesto en PDF, con envío por WhatsApp y email. */
@Module({
  imports: [VentasModule],
  controllers: [DocumentosController],
  providers: [DocumentosService],
  exports: [DocumentosService],
})
export class DocumentosModule {}
