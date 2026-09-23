import { Module } from '@nestjs/common';
import { NotificacionesController } from './notificaciones.controller.js';
import { NotificacionesService } from './notificaciones.service.js';
import { NOTIFICACIONES_REPOSITORY } from './notificaciones.repository.js';
import { PrismaNotificacionesRepository } from './prisma-notificaciones.repository.js';

@Module({
  controllers: [NotificacionesController],
  providers: [
    NotificacionesService,
    { provide: NOTIFICACIONES_REPOSITORY, useClass: PrismaNotificacionesRepository },
  ],
})
export class NotificacionesModule {}
