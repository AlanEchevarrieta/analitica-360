"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatoPesos } from "@/lib/formato";
import { useGuardarConfiguracion, type Configuracion } from "../hooks/use-configuracion";

/** Valor de la hora de trabajo: con los minutos de cada receta da la mano de obra del costo de fabricar. */
export function ProduccionConfig({ config }: { config: Configuracion }) {
  const guardar = useGuardarConfiguracion();
  const [valor, setValor] = useState(config.valorHora == null ? "" : String(config.valorHora));
  const n = valor.trim() === "" ? null : Number(valor.replace(",", "."));
  const valido = n === null || (Number.isFinite(n) && n >= 0);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prod-valor-hora">Valor de la hora de trabajo $</Label>
          <Input id="prod-valor-hora" className="w-40" inputMode="decimal" placeholder="Ej. 6000" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <Button
          disabled={!valido || n === config.valorHora || guardar.isPending}
          onClick={() => guardar.mutate({ valorHora: n }, { onSuccess: () => toast.success("Guardado"), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar") })}
        >
          Guardar
        </Button>
      </div>
      <p className="text-muted-foreground">
        Lo que te cuesta una hora de trabajo (sueldo + cargas, o lo que querés ganar vos por hora). Con los minutos de cada receta se calcula la mano de obra
        {n ? ` (ej. 20 minutos = ${formatoPesos((20 / 60) * n)})` : ""}. Se usa para fijar precios; no se suma al valor del stock, así no se cuenta dos veces si también cargás los sueldos como gasto.
      </p>
    </div>
  );
}
