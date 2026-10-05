import { Module } from '@nestjs/common';
import { ArchivosModule } from '../../common/archivos/archivos.module.js';
import { PlanesModule } from '../planes/planes.module.js';
import { RegistroModule } from '../registro/registro.module.js';
import { AdminBajasController, BajasController } from './bajas.controller.js';
import { BajasProgramador } from './bajas.programador.js';
import { BajasService } from './bajas.service.js';

@Module({
  imports: [PlanesModule, RegistroModule, ArchivosModule],
  controllers: [BajasController, AdminBajasController],
  providers: [BajasService, BajasProgramador],
})
export class BajasModule {}
