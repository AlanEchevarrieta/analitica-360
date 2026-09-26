import { Module } from '@nestjs/common';
import { ListasPreciosController } from './listas-precios.controller.js';
import { ListasPreciosService } from './listas-precios.service.js';

@Module({
  controllers: [ListasPreciosController],
  providers: [ListasPreciosService],
  exports: [ListasPreciosService],
})
export class ListasPreciosModule {}
