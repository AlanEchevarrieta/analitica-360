"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";
import { SoloCliente } from "./solo-cliente";

/**
 * Selector de organización (empresa/sucursal) de Clerk.
 * Responsive sin truncado agresivo en pantallas medianas y grandes.
 */
export function EmpresaSwitcher() {
  return (
    <div id="tour-empresa" className="flex items-center min-w-0 max-w-[125px] sm:max-w-[200px] md:max-w-[240px]">
      <SoloCliente reserva={<span className="block h-8 w-20 sm:w-36 rounded-md bg-muted/50" aria-hidden />}>
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/inicio"
          // Un negocio nuevo se crea con el registro (prueba gratis), no desde acá.
          appearance={{
            elements: {
              organizationSwitcherPopoverActionButton__createOrganization: { display: "none" },
              organizationSwitcherTrigger: { maxWidth: "100%", overflow: "hidden" },
              organizationPreview: { maxWidth: "100%", overflow: "hidden" },
              organizationPreviewTextContainer: { maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" },
            },
          }}
        />
      </SoloCliente>
    </div>
  );
}
