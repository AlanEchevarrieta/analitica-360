import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PedidosModule } from '../pedidos/pedidos.module.js';
import { TiendaController } from './tienda.controller.js';
import { TiendaService } from './tienda.service.js';
import { TIENDA_REPOSITORY } from './tienda.repository.js';
import { PrismaTiendaRepository } from './prisma-tienda.repository.js';

@Module({
  // Catálogo: 120 requests/min por cliente; pedidos: más estricto en el controller.
  imports: [PedidosModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])],
  controllers: [TiendaController],
  providers: [TiendaService, { provide: TIENDA_REPOSITORY, useClass: PrismaTiendaRepository }],
})
export class TiendaModule {}
