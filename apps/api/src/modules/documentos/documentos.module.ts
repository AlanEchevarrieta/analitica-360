import { Module } from '@nestjs/common';
import { ComprasModule } from '../compras/compras.module.js';
import { PedidosModule } from '../pedidos/pedidos.module.js';
import { VentasModule } from '../ventas/ventas.module.js';
import { ArmadoresComprasPedidos } from './armadores-compras-pedidos.js';
import { DocumentosController } from './documentos.controller.js';
import { DocumentosService } from './documentos.service.js';

/** Comprobante de venta, recibo, presupuesto, orden de compra y remito en PDF, con envío por WhatsApp y email. */
@Module({
  imports: [VentasModule, ComprasModule, PedidosModule],
  controllers: [DocumentosController],
  providers: [DocumentosService, ArmadoresComprasPedidos],
  exports: [DocumentosService],
})
export class DocumentosModule {}
