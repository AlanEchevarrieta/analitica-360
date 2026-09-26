import { SKU_REPOSITORY } from './sku.repository.js';
import { PrismaSkuRepository } from './prisma-sku.repository.js';
import { Module } from '@nestjs/common';
import { CategoriasController } from './categorias.controller.js';
import { CategoriasService } from './categorias.service.js';
import { CATEGORIAS_REPOSITORY } from './categorias.repository.js';
import { PrismaCategoriasRepository } from './prisma-categorias.repository.js';
import { ProductosController } from './productos.controller.js';
import { PreciosMasivosController } from './precios-masivos.controller.js';
import { PreciosMasivosService } from './precios-masivos.service.js';
import { ProductosService } from './productos.service.js';
import { PRODUCTOS_REPOSITORY } from './productos.repository.js';
import { PrismaProductosRepository } from './prisma-productos.repository.js';

@Module({
  controllers: [ProductosController, CategoriasController, PreciosMasivosController],
  providers: [
    ProductosService,
    PreciosMasivosService,
    CategoriasService,
    { provide: PRODUCTOS_REPOSITORY, useClass: PrismaProductosRepository },
    { provide: CATEGORIAS_REPOSITORY, useClass: PrismaCategoriasRepository },
    { provide: SKU_REPOSITORY, useClass: PrismaSkuRepository },
  ],
})
export class ProductosModule {}
