"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";

/**
 * Cada Organization de Clerk = una "empresa" del sistema (ver plan, sección
 * "Por qué Clerk para auth"). Funcional sin pulir — el diseño real
 * (paleta, layout del shell) es Fase 5.
 */
export function EmpresaSwitcher() {
  return (
    <OrganizationSwitcher
      hidePersonal
      afterSelectOrganizationUrl="/inicio"
      afterCreateOrganizationUrl="/inicio"
    />
  );
}
