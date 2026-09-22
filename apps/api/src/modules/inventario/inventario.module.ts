import { Module } from '@nestjs/common';
import { MovimientosController } from './movimientos.controller.js';
import { MovimientosService } from './movimientos.service.js';
import { MOVIMIENTOS_REPOSITORY } from './movimientos.repository.js';
import { PrismaMovimientosRepository } from './prisma-movimientos.repository.js';
import { LotesController } from './lotes.controller.js';
import { LotesService } from './lotes.service.js';
import { LOTES_REPOSITORY } from './lotes.repository.js';
import { PrismaLotesRepository } from './prisma-lotes.repository.js';

@Module({
  controllers: [MovimientosController, LotesController],
  providers: [
    MovimientosService,
    LotesService,
    { provide: MOVIMIENTOS_REPOSITORY, useClass: PrismaMovimientosRepository },
    { provide: LOTES_REPOSITORY, useClass: PrismaLotesRepository },
  ],
  exports: [MOVIMIENTOS_REPOSITORY],
})
export class InventarioModule {}
