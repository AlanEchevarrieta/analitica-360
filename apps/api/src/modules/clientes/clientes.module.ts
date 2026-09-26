import { Module } from '@nestjs/common';
import { ListasPreciosModule } from '../listas-precios/listas-precios.module.js';
import { ClientesController } from './clientes.controller.js';
import { DifusionesController } from './difusiones.controller.js';
import { ClientesService } from './clientes.service.js';
import { CLIENTES_REPOSITORY } from './clientes.repository.js';
import { PrismaClientesRepository } from './prisma-clientes.repository.js';

@Module({
  imports: [ListasPreciosModule],
  controllers: [ClientesController, DifusionesController],
  providers: [
    ClientesService,
    { provide: CLIENTES_REPOSITORY, useClass: PrismaClientesRepository },
  ],
  exports: [ClientesService],
})
export class ClientesModule {}
