import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module.js';
import { ProductosImportController } from './productos-import.controller.js';
import { ProductosImportService } from './productos-import.service.js';
import { PRODUCTOS_IMPORT_REPOSITORY } from './productos-import.repository.js';
import { PrismaProductosImportRepository } from './prisma-productos-import.repository.js';
import { ExportarDatosController } from './exportar-datos.controller.js';
import { ExportarDatosService } from './exportar-datos.service.js';
import { EXPORTAR_DATOS_REPOSITORY } from './exportar-datos.repository.js';
import { PrismaExportarDatosRepository } from './prisma-exportar-datos.repository.js';

@Module({
  imports: [ClientesModule],
  controllers: [ProductosImportController, ExportarDatosController],
  providers: [
    ProductosImportService,
    { provide: PRODUCTOS_IMPORT_REPOSITORY, useClass: PrismaProductosImportRepository },
    ExportarDatosService,
    { provide: EXPORTAR_DATOS_REPOSITORY, useClass: PrismaExportarDatosRepository },
  ],
})
export class ImportExportModule {}
