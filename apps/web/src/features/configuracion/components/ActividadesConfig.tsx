"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SelectorActividades } from "@/components/shared/selector-actividades";
import type { Actividad } from "@/lib/rubros";
import { useGuardarConfiguracion, type Configuracion } from "../hooks/use-configuracion";

/** Qué hace el negocio: arma el menú. Lo que no usa queda escondido (no se borra nada). */
export function ActividadesConfig({ config }: { config: Configuracion }) {
  const guardar = useGuardarConfiguracion();
  const [valor, setValor] = useState<Actividad[]>(config.actividades);
  const cambio = valor.length !== config.actividades.length || valor.some((a) => !config.actividades.includes(a));
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">Tildá lo que hace tu negocio y el menú muestra solo lo que usás. Lo que destildes queda escondido, no se borra: lo volvés a tildar y aparece con todo lo que tenía.</p>
      <SelectorActividades valor={valor} onChange={setValor} />
      <ul className="list-disc pl-5 text-muted-foreground">
        <li>
          <strong>Vendo productos:</strong> Pedidos, Inventario, Compras y Proveedores.
        </li>
        <li>
          <strong>Fabrico o produzco:</strong> lo anterior y Producción.
        </li>
        <li>
          <strong>Doy servicios:</strong> Agenda, Abonos, Órdenes de trabajo y Comisiones (plan Pro).
        </li>
      </ul>
      {valor.length === 0 && <p className="text-destructive">Tildá al menos una.</p>}
      <Button
        className="w-fit"
        disabled={!cambio || valor.length === 0 || guardar.isPending}
        onClick={() => guardar.mutate({ actividades: valor }, { onSuccess: () => toast.success("Listo: el menú ya se acomodó"), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar") })}
      >
        Guardar
      </Button>
    </div>
  );
}
