import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Excluye el endpoint del ClerkAuthGuard global (APP_GUARD). Usar solo en
 * el webhook de Clerk y en healthchecks.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
