import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Semaforo } from "../types";

export const TOOLTIP_ESTILO = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };

export function Kpi({ titulo, valor, detalle, semaforo }: { titulo: string; valor: string; detalle?: string; semaforo?: Semaforo }) {
  const color = semaforo === "verde" ? "bg-emerald-500" : semaforo === "amarillo" ? "bg-amber-500" : semaforo === "rojo" ? "bg-red-500" : null;
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {color && <span className={`size-2 rounded-full ${color}`} aria-hidden />}
          {titulo}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{valor}</CardTitle>
        {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
      </CardHeader>
    </Card>
  );
}
