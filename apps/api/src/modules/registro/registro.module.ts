import { Module } from '@nestjs/common';
import { AdminAvisosController } from './admin-avisos.controller.js';
import { ClerkCuentasService } from './clerk-cuentas.service.js';
import { RegistroController } from './registro.controller.js';
import { RegistroService } from './registro.service.js';

@Module({
  controllers: [RegistroController, AdminAvisosController],
  providers: [RegistroService, ClerkCuentasService],
  exports: [ClerkCuentasService],
})
export class RegistroModule {}
