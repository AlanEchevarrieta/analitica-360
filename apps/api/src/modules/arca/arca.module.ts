import { Module } from '@nestjs/common';
import { ArcaCliente } from './arca.cliente.js';
import { FacturacionController } from './facturacion.controller.js';
import { FacturacionService } from './facturacion.service.js';

@Module({
  controllers: [FacturacionController],
  providers: [ArcaCliente, FacturacionService],
  exports: [FacturacionService],
})
export class ArcaModule {}
