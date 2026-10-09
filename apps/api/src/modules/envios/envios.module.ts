import { Module } from '@nestjs/common';
import { AvisosZipnovaController, EnviosController, PedidoEnvioController } from './envios.controller.js';
import { EnviosService } from './envios.service.js';
import { ZipnovaCliente } from './zipnova.cliente.js';

@Module({
  controllers: [EnviosController, PedidoEnvioController, AvisosZipnovaController],
  providers: [ZipnovaCliente, EnviosService],
  exports: [EnviosService],
})
export class EnviosModule {}
