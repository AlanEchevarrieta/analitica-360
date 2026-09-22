import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller.js';
import { DifusionesController } from './difusiones.controller.js';
import { ClientesService } from './clientes.service.js';
import { CLIENTES_REPOSITORY } from './clientes.repository.js';
import { PrismaClientesRepository } from './prisma-clientes.repository.js';

@Module({
  controllers: [ClientesController, DifusionesController],
  providers: [
    ClientesService,
    { provide: CLIENTES_REPOSITORY, useClass: PrismaClientesRepository },
  ],
})
export class ClientesModule {}
