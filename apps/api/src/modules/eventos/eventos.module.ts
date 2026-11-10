import { Global, Module } from '@nestjs/common';
import { CorreoService } from './correo.service.js';
import { EventosAdminController } from './eventos-admin.controller.js';
import { EventosService } from './eventos.service.js';
import { EventosTrabajador } from './eventos.trabajador.js';

@Global()
@Module({
  controllers: [EventosAdminController],
  providers: [CorreoService, EventosService, EventosTrabajador],
  exports: [CorreoService, EventosService],
})
export class EventosModule {}
