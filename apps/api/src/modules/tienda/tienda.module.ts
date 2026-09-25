import { Module } from '@nestjs/common';
import { PedidosModule } from '../pedidos/pedidos.module.js';
import { TiendaController } from './tienda.controller.js';
import { TiendaService } from './tienda.service.js';
import { TIENDA_REPOSITORY } from './tienda.repository.js';
import { PrismaTiendaRepository } from './prisma-tienda.repository.js';

@Module({
  imports: [PedidosModule],
  controllers: [TiendaController],
  providers: [TiendaService, { provide: TIENDA_REPOSITORY, useClass: PrismaTiendaRepository }],
})
export class TiendaModule {}
