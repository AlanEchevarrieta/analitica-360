import { SKU_REPOSITORY } from './sku.repository.js';
import { PrismaSkuRepository } from './prisma-sku.repository.js';
import { Module } from '@nestjs/common';
import { AtributosController } from './atributos.controller.js';
import { AtributosService } from './atributos.service.js';
import { ATRIBUTOS_REPOSITORY } from './atributos.repository.js';
import { PrismaAtributosRepository } from './prisma-atributos.repository.js';
import { VariantesController } from './variantes.controller.js';
import { VariantesService } from './variantes.service.js';
import { VARIANTES_REPOSITORY } from './variantes.repository.js';
import { PrismaVariantesRepository } from './prisma-variantes.repository.js';

@Module({
  controllers: [AtributosController, VariantesController],
  providers: [
    AtributosService,
    VariantesService,
    { provide: ATRIBUTOS_REPOSITORY, useClass: PrismaAtributosRepository },
    { provide: VARIANTES_REPOSITORY, useClass: PrismaVariantesRepository },
    { provide: SKU_REPOSITORY, useClass: PrismaSkuRepository },
  ],
})
export class VariantesModule {}
