/**
 * Subconjunto de eventos de Clerk que nos interesan (organization.* /
 * organizationMembership.*), ya parseados y verificados por apps/web
 * (POST /api/webhooks/clerk ahí, con svix) antes de reenviarse acá. El resto
 * de los tipos de evento que Clerk pueda mandar se ignoran (catch-all).
 *
 * Referencia de payload: https://clerk.com/docs/webhooks/overview
 */
export interface ClerkOrganizationCreatedEvent {
  type: 'organization.created';
  data: { id: string; name: string };
}

export interface ClerkOrganizationMembershipEvent {
  type: 'organizationMembership.created' | 'organizationMembership.updated';
  data: {
    organization: { id: string; name: string };
    public_user_data: { user_id: string; identifier: string };
    // Rol de Clerk: 'org:admin' | 'org:member' | 'org:contador' (custom role,
    // ver TODO en usuarios.service.ts) | otros roles custom.
    role: string;
  };
}

export interface ClerkOrganizationMembershipDeletedEvent {
  type: 'organizationMembership.deleted';
  data: {
    organization: { id: string };
    public_user_data: { user_id: string };
  };
}

export type ClerkKnownWebhookEvent =
  | ClerkOrganizationCreatedEvent
  | ClerkOrganizationMembershipEvent
  | ClerkOrganizationMembershipDeletedEvent;

/**
 * Tipo del body tal como llega al controller: cualquier evento de Clerk, no
 * solo los que nos interesan (`type: string` genérico a propósito, no debe
 * unirse en un discriminated union con ClerkKnownWebhookEvent — un `type`
 * genérico ahí rompe la discriminación por literal en el switch del
 * service). El narrowing a un evento conocido se hace en usuarios.service.ts.
 */
export interface ClerkWebhookEvent {
  type: string;
  data: unknown;
}
