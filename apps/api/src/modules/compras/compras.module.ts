import { Module } from '@nestjs/common';
import { ComprasController } from './compras.controller.js';
import { ComprasService } from './compras.service.js';
import { COMPRAS_REPOSITORY } from './compras.repository.js';
import { PrismaComprasRepository } from './prisma-compras.repository.js';

@Module({
  controllers: [ComprasController],
  providers: [
    ComprasService,
    { provide: COMPRAS_REPOSITORY, useClass: PrismaComprasRepository },
  ],
})
export class ComprasModule {}
