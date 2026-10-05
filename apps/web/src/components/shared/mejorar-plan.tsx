"use client";

import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { PLANES } from "@analitica360/shared-types";
import { buttonVariants } from "@/components/ui/button";
import { NOMBRE_FUNCION, usePlan } from "@/hooks/use-plan";
import { cn } from "@/lib/utils";

/** Lo que trae el plan superior que no tiene el actual (para que se entienda qué gana). */
function novedades(desde: string | undefined, hacia: keyof typeof PLANES) {
  const actuales = new Set<string>(desde ? PLANES[desde as keyof typeof PLANES]?.funciones ?? [] : []);
  return PLANES[hacia].funciones.filter((f) => !actuales.has(f) && NOMBRE_FUNCION[f]).map((f) => NOMBRE_FUNCION[f]);
}

/** En lugar de una sección que el plan no incluye: qué es, en qué plan está y cómo pasarse. */
export function MejorarPlan({ funcion, compacto = false }: { funcion: string; compacto?: boolean }) {
  const { plan, planMinimo } = usePlan();
  const minimo = planMinimo(funcion);
  const extra = novedades(plan?.id, minimo.id);
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-xl text-center ring-1 ring-foreground/10", compacto ? "p-6" : "p-10")}>
      <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
        <Lock className="size-5" aria-hidden />
      </span>
      <p className="text-lg font-semibold">{NOMBRE_FUNCION[funcion] ?? "Esta sección"} está en el plan {minimo.nombre}</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Tu plan actual es {plan?.nombre ?? "—"}. Tus datos no se pierden: al pasarte, esta sección aparece con todo lo que ya cargaste.
      </p>
      {!compacto && extra.length > 0 && (
        <ul className="grid gap-1 text-left text-sm sm:grid-cols-2">
          {extra.map((e) => (
            <li key={e} className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" aria-hidden /> {e}
            </li>
          ))}
        </ul>
      )}
      <Link href={`/planes?mejorar=${minimo.id}`} className={cn(buttonVariants(), "mt-1")}>
        Ver el plan {minimo.nombre}
      </Link>
    </div>
  );
}

/** Candado chico al lado de un ítem de menú que el plan no incluye. */
export function CandadoPlan({ funcion }: { funcion: string }) {
  const { planMinimo } = usePlan();
  return (
    <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-muted-foreground" title={`Disponible en ${planMinimo(funcion).nombre}`}>
      <Lock className="size-3" aria-hidden />
      {planMinimo(funcion).nombre}
    </span>
  );
}
