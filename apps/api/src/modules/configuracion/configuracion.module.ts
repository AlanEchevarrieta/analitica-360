import { Module } from '@nestjs/common';
import { ConfiguracionController } from './configuracion.controller.js';
import { CONFIGURACION_REPOSITORY } from './configuracion.repository.js';
import { PrismaConfiguracionRepository } from './prisma-configuracion.repository.js';

@Module({
  controllers: [ConfiguracionController],
  providers: [{ provide: CONFIGURACION_REPOSITORY, useClass: PrismaConfiguracionRepository }],
})
export class ConfiguracionModule {}
