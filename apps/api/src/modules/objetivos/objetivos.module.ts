import { Module } from '@nestjs/common';
import { PlanesModule } from '../planes/planes.module.js';
import { ObjetivosController } from './objetivos.controller.js';
import { ObjetivosService } from './objetivos.service.js';

@Module({
  imports: [PlanesModule],
  controllers: [ObjetivosController],
  providers: [ObjetivosService],
  exports: [ObjetivosService],
})
export class ObjetivosModule {}
