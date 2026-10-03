import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditoriaInterceptor } from '../../common/auditoria/auditoria.interceptor.js';
import { AuditoriaAdminController, AuditoriaController } from './auditoria.controller.js';
import { AuditoriaService } from './auditoria.service.js';

@Module({
  controllers: [AuditoriaController, AuditoriaAdminController],
  providers: [AuditoriaService, { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor }],
})
export class AuditoriaModule {}
