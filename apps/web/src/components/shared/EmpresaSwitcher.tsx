"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";
import { SoloCliente } from "./solo-cliente";

/**
 * Cada Organization de Clerk = una "empresa" del sistema (ver plan, sección
 * "Por qué Clerk para auth"). Funcional sin pulir — el diseño real
 * (paleta, layout del shell) es Fase 5.
 */
export function EmpresaSwitcher() {
  return (
    <SoloCliente reserva={<span className="block h-8 w-40 rounded-md bg-muted/50" aria-hidden />}>
      <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/inicio" afterCreateOrganizationUrl="/inicio" />
    </SoloCliente>
  );
}
