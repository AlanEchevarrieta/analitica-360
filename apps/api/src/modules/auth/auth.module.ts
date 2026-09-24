import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard.js';
import { EmpresaScopeGuard } from '../../common/guards/empresa-scope.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { AdminAppGuard } from '../../common/guards/admin-app.guard.js';

/**
 * Cadena de guards globales, en orden (importa el orden: cada uno asume que
 * el anterior ya corrió):
 *   1. ClerkAuthGuard      -> request.clerkAuth (JWT válido)
 *   2. EmpresaScopeGuard   -> request.empresa + request.usuario
 *   3. RolesGuard          -> @Roles(...)
 *   4. PermissionsGuard    -> @RequireModulo()/@RequirePermiso()
 *   5. AdminAppGuard       -> @RequireAdminApp() (staff cross-tenant, ver es_admin_app())
 *
 * Todos respetan @Public() para excluir endpoints (webhooks, healthcheck).
 */
@Module({
  imports: [UsuariosModule],
  providers: [
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: EmpresaScopeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: AdminAppGuard },
  ],
})
export class AuthModule {}
