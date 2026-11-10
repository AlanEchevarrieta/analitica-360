import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Semaforo } from "../types";

export function Kpi({ titulo, valor, detalle, semaforo }: { titulo: string; valor: string; detalle?: string; semaforo?: Semaforo }) {
  const color = semaforo === "verde" ? "bg-emerald-500" : semaforo === "amarillo" ? "bg-amber-500" : semaforo === "rojo" ? "bg-red-500" : null;
  return (
    <Card size="sm" className="h-full">
      <CardHeader className="min-w-0">
        <CardDescription className="flex items-center gap-1.5 truncate text-xs sm:text-sm" title={titulo}>
          {color && <span className={`size-2 shrink-0 rounded-full ${color}`} aria-hidden />}
          <span className="truncate">{titulo}</span>
        </CardDescription>
        <CardTitle className="min-w-0 truncate text-lg tabular-nums sm:text-2xl" title={valor}>
          {valor}
        </CardTitle>
        {detalle && (
          <p className="line-clamp-2 text-xs text-muted-foreground sm:line-clamp-none" title={detalle}>
            {detalle}
          </p>
        )}
      </CardHeader>
    </Card>
  );
}
