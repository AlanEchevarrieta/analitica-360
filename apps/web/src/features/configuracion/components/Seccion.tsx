import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Sección plegable de Configuración (como en el legacy: ícono, título y subtítulo). */
export function Seccion({ icono, titulo, subtitulo, children, abierta = false }: { icono: string; titulo: string; subtitulo: string; children: ReactNode; abierta?: boolean }) {
  return (
    <details className="group rounded-xl bg-card ring-1 ring-foreground/10" open={abierta}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="text-xl" aria-hidden>
          {icono}
        </span>
        <span className="flex-1">
          <span className="block font-medium">{titulo}</span>
          <span className="block text-sm text-muted-foreground">{subtitulo}</span>
        </span>
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
  );
}
