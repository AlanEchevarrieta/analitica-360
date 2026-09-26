import { Module } from '@nestjs/common';
import { AdminSaasController } from './admin-saas.controller.js';
import { AdminAccesoController } from './admin-acceso.controller.js';
import { AdminSaasService } from './admin-saas.service.js';
import { ADMIN_SAAS_REPOSITORY } from './admin-saas.repository.js';
import { PrismaAdminSaasRepository } from './prisma-admin-saas.repository.js';
import { PrismaAdminClientesRepository } from './prisma-admin-clientes.repository.js';

@Module({
  controllers: [AdminAccesoController, AdminSaasController],
  providers: [AdminSaasService, PrismaAdminClientesRepository, { provide: ADMIN_SAAS_REPOSITORY, useClass: PrismaAdminSaasRepository }],
})
export class AdminSaasModule {}
