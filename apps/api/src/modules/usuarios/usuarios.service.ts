import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RolCrudo } from '../../common/auth/rol.types.js';
import { USUARIOS_REPOSITORY, type UsuariosRepository } from './usuarios.repository.js';
import type {
  ClerkOrganizationCreatedEvent,
  ClerkOrganizationMembershipDeletedEvent,
  ClerkOrganizationMembershipEvent,
  ClerkWebhookEvent,
} from './clerk-webhook-event.types.js';

/**
 * Mapea el rol de Organization Membership de Clerk a nuestro RolCrudo.
 *
 * TODO Fase 3: 'contador' no es un rol nativo de Clerk — hay que crear un
 * Custom Role 'org:contador' en Configure -> Organizations -> Roles del
 * dashboard de Clerk para que este mapeo funcione end-to-end. Hasta
 * entonces, invitar a alguien como contador requiere asignar el rol acá
 * manualmente (o vía un endpoint admin propio, análogo a invitar_contador()
 * en supabase/070_rol_contador.sql).
 */
function mapearRolClerk(rolClerk: string): RolCrudo {
  if (rolClerk === 'org:admin') return 'dueno';
  if (rolClerk === 'org:contador') return 'contador';
  return 'operario';
}

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(@Inject(USUARIOS_REPOSITORY) private readonly usuariosRepository: UsuariosRepository) {}

  async procesarEventoClerk(event: ClerkWebhookEvent): Promise<void> {
    switch (event.type) {
      case 'organization.created': {
        const { data } = event as ClerkOrganizationCreatedEvent;
        await this.usuariosRepository.upsertEmpresa({
          clerkOrgId: data.id,
          nombre: data.name,
        });
        return;
      }
      case 'organizationMembership.created':
      case 'organizationMembership.updated': {
        const { data } = event as ClerkOrganizationMembershipEvent;
        const empresa = await this.usuariosRepository.upsertEmpresa({
          clerkOrgId: data.organization.id,
          nombre: data.organization.name,
        });
        await this.usuariosRepository.upsertUsuario({
          clerkUserId: data.public_user_data.user_id,
          empresaId: empresa.id,
          email: data.public_user_data.identifier,
          rolCrudo: mapearRolClerk(data.role),
        });
        return;
      }
      case 'organizationMembership.deleted': {
        const { data } = event as ClerkOrganizationMembershipDeletedEvent;
        await this.usuariosRepository.removeUsuario(data.public_user_data.user_id);
        return;
      }
      default: {
        this.logger.debug(`Evento de Clerk ignorado: ${event.type}`);
      }
    }
  }
}
