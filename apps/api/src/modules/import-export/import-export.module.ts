import { Module } from '@nestjs/common';
import { ProductosImportController } from './productos-import.controller.js';
import { ProductosImportService } from './productos-import.service.js';
import { PRODUCTOS_IMPORT_REPOSITORY } from './productos-import.repository.js';
import { PrismaProductosImportRepository } from './prisma-productos-import.repository.js';

@Module({
  controllers: [ProductosImportController],
  providers: [
    ProductosImportService,
    { provide: PRODUCTOS_IMPORT_REPOSITORY, useClass: PrismaProductosImportRepository },
  ],
})
export class ImportExportModule {}
