import { Module } from '@nestjs/common';
import { AdminSaasController } from './admin-saas.controller.js';
import { AdminSaasService } from './admin-saas.service.js';
import { ADMIN_SAAS_REPOSITORY } from './admin-saas.repository.js';
import { PrismaAdminSaasRepository } from './prisma-admin-saas.repository.js';

@Module({
  controllers: [AdminSaasController],
  providers: [AdminSaasService, { provide: ADMIN_SAAS_REPOSITORY, useClass: PrismaAdminSaasRepository }],
})
export class AdminSaasModule {}
