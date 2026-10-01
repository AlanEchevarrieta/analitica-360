import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import type { Env } from '../../config/env.validation.js';

export interface DatosUsuarioClerk {
  email: string;
  nombre: string;
}

/** Lo poco que el registro necesita de la API de Clerk (aislado para poder probarlo). */
@Injectable()
export class ClerkCuentasService {
  private readonly clerk: ClerkClient;

  constructor(config: ConfigService<Env, true>) {
    this.clerk = createClerkClient({ secretKey: config.get('CLERK_SECRET_KEY', { infer: true }) });
  }

  async usuario(clerkUserId: string): Promise<DatosUsuarioClerk> {
    const u = await this.clerk.users.getUser(clerkUserId);
    const email = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? '';
    const nombre = [u.firstName, u.lastName].filter(Boolean).join(' ') || email.split('@')[0] || 'Dueño';
    return { email, nombre };
  }

  /** Crea la organización (empresa) con el usuario como administrador. */
  async crearOrganizacion(nombre: string, clerkUserId: string): Promise<string> {
    const org = await this.clerk.organizations.createOrganization({ name: nombre, createdBy: clerkUserId });
    return org.id;
  }

  /**
   * Un negocio nuevo se crea solo con el registro (prueba de 14 días). Sin esto,
   * el usuario podría crear organizaciones desde los componentes de Clerk
   * (empresas sin prueba ni plan). El registro las crea desde el servidor, así
   * que no le afecta.
   */
  async bloquearCrearOrganizaciones(clerkUserId: string): Promise<void> {
    await this.clerk.users.updateUser(clerkUserId, { createOrganizationEnabled: false });
  }

  async borrarOrganizacion(clerkOrgId: string): Promise<void> {
    await this.clerk.organizations.deleteOrganization(clerkOrgId);
  }
}
