import { SetMetadata } from '@nestjs/common';
import type { Rol } from '../auth/rol.types.js';

export const ROLES_KEY = 'roles';

/** Requiere que el usuario autenticado tenga uno de estos roles (normalizados). */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
