import { Module } from '@nestjs/common';
import { ComprasController } from './compras.controller.js';
import { ComprasService } from './compras.service.js';
import { COMPRAS_REPOSITORY } from './compras.repository.js';
import { PrismaComprasRepository } from './prisma-compras.repository.js';
import { OrdenesCompraController } from './ordenes-compra.controller.js';
import { OrdenesCompraService } from './ordenes-compra.service.js';
import { ORDENES_COMPRA_REPOSITORY } from './ordenes-compra.repository.js';
import { PrismaOrdenesCompraRepository } from './prisma-ordenes-compra.repository.js';

@Module({
  controllers: [ComprasController, OrdenesCompraController],
  providers: [
    ComprasService,
    { provide: COMPRAS_REPOSITORY, useClass: PrismaComprasRepository },
    OrdenesCompraService,
    { provide: ORDENES_COMPRA_REPOSITORY, useClass: PrismaOrdenesCompraRepository },
  ],
})
export class ComprasModule {}
