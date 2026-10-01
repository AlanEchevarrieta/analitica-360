import { Module } from '@nestjs/common';
import { EquipoController } from './equipo.controller.js';
import { MiAccesoController } from './mi-acceso.controller.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';
import { USUARIOS_REPOSITORY } from './usuarios.repository.js';
import { PrismaUsuariosRepository } from './prisma-usuarios.repository.js';
import { RegistroModule } from '../registro/registro.module.js';

@Module({
  // ClerkCuentasService: a quien entra por invitación se le quita "crear organizaciones".
  imports: [RegistroModule],
  controllers: [UsuariosController, MiAccesoController, EquipoController],
  providers: [
    UsuariosService,
    { provide: USUARIOS_REPOSITORY, useClass: PrismaUsuariosRepository },
  ],
  exports: [USUARIOS_REPOSITORY],
})
export class UsuariosModule {}
