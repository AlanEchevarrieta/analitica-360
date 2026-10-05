import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RolCrudo } from '../../common/auth/rol.types.js';
import { ClerkCuentasService } from '../registro/clerk-cuentas.service.js';
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
 * 'contador' no es un rol nativo de Clerk: para invitar contadores desde Clerk
 * hay que crear el rol personalizado 'org:contador' en el panel de Clerk
 * (Configure → Organizations → Roles). Ver Pendientes en Obsidian.
 */
function mapearRolClerk(rolClerk: string): RolCrudo {
  if (rolClerk === 'org:admin') return 'dueno';
  if (rolClerk === 'org:contador') return 'contador';
  return 'operario';
}

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @Inject(USUARIOS_REPOSITORY) private readonly usuariosRepository: UsuariosRepository,
    private readonly clerkCuentas: ClerkCuentasService,
  ) {}

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
        // Los negocios nuevos se crean solo con el registro (prueba gratis).
        if (event.type === 'organizationMembership.created') {
          await this.clerkCuentas
            .bloquearCrearOrganizaciones(data.public_user_data.user_id)
            .catch((e) => this.logger.warn(`No se pudo quitar "crear organizaciones" a ${data.public_user_data.user_id}: ${String(e)}`));
        }
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
