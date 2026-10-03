"use client";

import { BitacoraAuditoria } from "@/components/shared/bitacora-auditoria";
import { useRol } from "@/hooks/use-rol";

/** Configuración → Auditoría: solo el dueño ve lo que hizo cada persona del equipo. */
export function AuditoriaConfig() {
  const rol = useRol();
  if (rol !== "dueno") return <p className="text-sm text-muted-foreground">Solo el dueño de la cuenta puede ver la auditoría.</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Cada alta, cambio, baja o anulación queda registrada con quién la hizo y cuándo. Nadie puede editarla ni borrarla, ni siquiera nosotros. Tocá un renglón para ver qué cambió.
      </p>
      <BitacoraAuditoria ruta="/auditoria" />
    </div>
  );
}
