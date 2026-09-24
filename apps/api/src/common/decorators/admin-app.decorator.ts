import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ADMIN_APP_KEY = 'requireAdminApp';

/**
 * Requiere ser "admin de la app" - staff de Analítica 360 con acceso
 * cross-tenant, NO un dueño de empresa. Puerto fiel de es_admin_app()
 * (supabase/002_trial_admin.sql): el email del usuario autenticado está en
 * la tabla admin_emails. Cruza tenants a propósito - deliberadamente
 * independiente de @RequireModulo/@RequirePermiso/@Roles (esos gatean
 * DENTRO de la empresa del usuario, esto gatea operaciones que no
 * pertenecen a ninguna empresa en particular).
 */
export const RequireAdminApp = () => SetMetadata(REQUIRE_ADMIN_APP_KEY, true);
