import { Module } from '@nestjs/common';
import { PlanesModule } from '../planes/planes.module.js';
import { AgendaOnlineService } from './agenda-online.service.js';
import { AgendaController } from './agenda.controller.js';
import { AgendaService } from './agenda.service.js';

/** Agenda y turnos (módulo de servicios, pieza 3). La reserva online la expone la tienda (TiendaController). */
@Module({
  imports: [PlanesModule],
  controllers: [AgendaController],
  providers: [AgendaService, AgendaOnlineService],
  exports: [AgendaService, AgendaOnlineService],
})
export class AgendaModule {}
