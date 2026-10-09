import { Module } from '@nestjs/common';
import { MpTiendaCliente } from './mp-tienda.cliente.js';
import { AvisosMpTiendaController, MpTiendaController, MpTiendaVueltaController } from './mp-tienda.controller.js';
import { MpTiendaService } from './mp-tienda.service.js';

@Module({
  controllers: [MpTiendaController, MpTiendaVueltaController, AvisosMpTiendaController],
  providers: [MpTiendaCliente, MpTiendaService],
  exports: [MpTiendaService],
})
export class MpTiendaModule {}
