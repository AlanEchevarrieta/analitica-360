import { Module } from '@nestjs/common';
import { PlantillasProyectoController } from './plantillas-proyecto.controller.js';
import { PlantillasProyectoService } from './plantillas-proyecto.service.js';
import { ProyectosController } from './proyectos.controller.js';
import { ProyectosService } from './proyectos.service.js';

@Module({
  controllers: [ProyectosController, PlantillasProyectoController],
  providers: [ProyectosService, PlantillasProyectoService],
  exports: [ProyectosService, PlantillasProyectoService],
})
export class ProyectosModule {}
