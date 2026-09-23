import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICACIONES_REPOSITORY, type ConteoNotificaciones, type NotificacionesRepository } from './notificaciones.repository.js';

@Injectable()
export class NotificacionesService {
  constructor(@Inject(NOTIFICACIONES_REPOSITORY) private readonly repository: NotificacionesRepository) {}

  contar(empresaId: string): Promise<ConteoNotificaciones> {
    return this.repository.contar(empresaId);
  }
}
