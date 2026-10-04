import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PedidosModule } from '../pedidos/pedidos.module.js';
import { TiendaController } from './tienda.controller.js';
import { ProductoFotosController, TiendaConfigController, TiendaSitioController } from './tienda-admin.controller.js';
import { TiendaAdminService } from './tienda-admin.service.js';
import { CuponesTiendaController, DescuentosTiendaService, OfertasController } from './descuentos-admin.js';
import { TiendaService } from './tienda.service.js';
import { TIENDA_REPOSITORY } from './tienda.repository.js';
import { PrismaTiendaRepository } from './prisma-tienda.repository.js';

@Module({
  // Catálogo: 120 requests/min por cliente; pedidos: más estricto en el controller.
  imports: [PedidosModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])],
  controllers: [TiendaController, TiendaConfigController, ProductoFotosController, TiendaSitioController, OfertasController, CuponesTiendaController],
  providers: [TiendaService, TiendaAdminService, DescuentosTiendaService, { provide: TIENDA_REPOSITORY, useClass: PrismaTiendaRepository }],
})
export class TiendaModule {}
