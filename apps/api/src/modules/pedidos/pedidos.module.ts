import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller.js';
import { PedidosService } from './pedidos.service.js';
import { PEDIDOS_REPOSITORY } from './pedidos.repository.js';
import { PrismaPedidosRepository } from './prisma-pedidos.repository.js';

@Module({
  controllers: [PedidosController],
  providers: [
    PedidosService,
    { provide: PEDIDOS_REPOSITORY, useClass: PrismaPedidosRepository },
  ],
})
export class PedidosModule {}
