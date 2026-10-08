import { Module } from '@nestjs/common';
import { PlanesModule } from '../planes/planes.module.js';
import { ObjetivosController } from './objetivos.controller.js';
import { ObjetivosProgramador } from './objetivos.programador.js';
import { ObjetivosService } from './objetivos.service.js';

@Module({
  imports: [PlanesModule],
  controllers: [ObjetivosController],
  providers: [ObjetivosService, ObjetivosProgramador],
  exports: [ObjetivosService],
})
export class ObjetivosModule {}
