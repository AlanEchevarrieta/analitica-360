"use client";

import Link from "next/link";
import { FileWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlan } from "@/hooks/use-plan";
import { useRol } from "@/hooks/use-rol";
import { cn } from "@/lib/utils";
import { nombreCategoria, usePorVencer } from "./use-archivo";

/** Inicio: documentos vencidos o que vencen en los próximos 30 días (dueño y contador, con archivo en el plan). */
export function PorVencerCard() {
  const rol = useRol();
  const plan = usePlan();
  const habilitado = (rol === "dueno" || rol === "contador") && plan.disponible("archivo");
  const { data } = usePorVencer(habilitado);
  if (!habilitado || !data || data.length === 0) return null;
  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileWarning className="size-4 text-amber-500" /> Documentos por vencer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1.5 text-sm">
          {data.slice(0, 5).map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {d.titulo} <span className="text-muted-foreground">· {nombreCategoria(d.categoria)}</span>
              </span>
              <span className={cn("text-xs font-medium", d.estado === "vencido" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-300")}>
                {d.estado === "vencido" ? "Vencido" : d.diasParaVencer === 0 ? "Vence hoy" : `En ${d.diasParaVencer} días`}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/documentos" className="mt-3 inline-block text-sm text-primary hover:underline">
          Ver documentos
        </Link>
      </CardContent>
    </Card>
  );
}
