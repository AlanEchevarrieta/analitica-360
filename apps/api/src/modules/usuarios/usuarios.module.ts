import { Module } from '@nestjs/common';
import { MiAccesoController } from './mi-acceso.controller.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';
import { USUARIOS_REPOSITORY } from './usuarios.repository.js';
import { PrismaUsuariosRepository } from './prisma-usuarios.repository.js';

@Module({
  controllers: [UsuariosController, MiAccesoController],
  providers: [
    UsuariosService,
    { provide: USUARIOS_REPOSITORY, useClass: PrismaUsuariosRepository },
  ],
  exports: [USUARIOS_REPOSITORY],
})
export class UsuariosModule {}
