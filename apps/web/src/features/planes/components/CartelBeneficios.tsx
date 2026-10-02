import { CheckCircle2, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cartel destacado de un código: de qué cámara es y sus beneficios en palabras
 * (los arma la API desde las reglas del cupón, así cada código muestra los suyos).
 */
export function CartelBeneficios({
  codigo,
  camara,
  beneficios,
  aplicado,
  compacto = false,
  className,
}: {
  codigo: string;
  camara: string | null;
  beneficios: string[];
  aplicado: boolean;
  compacto?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/8 to-emerald-500/10 ring-1 ring-primary/40",
        compacto ? "p-3" : "p-5 sm:p-6",
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-10 -right-10 size-36 rounded-full bg-primary/15 blur-2xl" aria-hidden />
      <div className="relative flex items-start gap-3">
        <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm", compacto ? "size-8" : "size-11")}>
          <PartyPopper className={compacto ? "size-4" : "size-5"} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className={cn("font-semibold leading-tight", compacto ? "text-sm" : "text-lg")}>
            Código <span className="font-mono">{codigo}</span> {aplicado ? "aplicado" : "válido"}
          </p>
          {camara && <p className={cn("text-muted-foreground", compacto ? "text-xs" : "text-sm")}>Beneficio exclusivo para socios de {camara}</p>}
          {beneficios.length > 0 && (
            <ul className={cn("mt-1 flex flex-col", compacto ? "gap-1 text-xs" : "gap-1.5 text-sm")}>
              {beneficios.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <CheckCircle2 className={cn("mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400", compacto ? "size-3.5" : "size-4")} aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
