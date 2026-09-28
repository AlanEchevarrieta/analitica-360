import { Global, Module } from '@nestjs/common';
import { AlmacenArchivosService } from './almacen-archivos.service.js';

@Global()
@Module({ providers: [AlmacenArchivosService], exports: [AlmacenArchivosService] })
export class ArchivosModule {}
