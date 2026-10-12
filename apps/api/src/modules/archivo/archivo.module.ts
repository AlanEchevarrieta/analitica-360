import { Module } from '@nestjs/common';
import { ArchivoController } from './archivo.controller.js';
import { ArchivoProgramador } from './archivo.programador.js';
import { ArchivoService } from './archivo.service.js';

/** Archivo de documentos del negocio con vencimientos (plan Pro). */
@Module({
  controllers: [ArchivoController],
  providers: [ArchivoService, ArchivoProgramador],
})
export class ArchivoModule {}
