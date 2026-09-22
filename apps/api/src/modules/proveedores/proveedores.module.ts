import { Module } from '@nestjs/common';
import { ProveedoresController } from './proveedores.controller.js';
import { ProveedoresService } from './proveedores.service.js';
import { PROVEEDORES_REPOSITORY } from './proveedores.repository.js';
import { PrismaProveedoresRepository } from './prisma-proveedores.repository.js';

@Module({
  controllers: [ProveedoresController],
  providers: [
    ProveedoresService,
    { provide: PROVEEDORES_REPOSITORY, useClass: PrismaProveedoresRepository },
  ],
  exports: [PROVEEDORES_REPOSITORY],
})
export class ProveedoresModule {}
