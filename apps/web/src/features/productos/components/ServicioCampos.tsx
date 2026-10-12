"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NOMBRE_MODO_PRECIO, type ModoPrecio } from "../types";

const AYUDA: Record<ModoPrecio, string> = {
  fijo: 'Si usa materiales (tintura, aceite, repuestos), armale una receta en Producción y marcala "se arma al vender": se descuentan solos.',
  por_hora: "El precio es por hora: en la venta, la cantidad son las horas.",
  a_presupuestar: "El precio se escribe en cada venta o presupuesto.",
};

/** En el formulario del producto: marcarlo como servicio, cómo se cobra y cuánto dura. */
export function ServicioCampos({
  esServicio,
  onEsServicio,
  modoPrecio,
  onModoPrecio,
  duracion,
  onDuracion,
}: {
  esServicio: boolean;
  onEsServicio: (v: boolean) => void;
  modoPrecio: ModoPrecio;
  onModoPrecio: (v: ModoPrecio) => void;
  duracion: string;
  onDuracion: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={esServicio} onChange={(e) => onEsServicio(e.target.checked)} />
        Es un servicio (un corte, un service, una clase…): no tiene stock
      </label>
      {esServicio && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="producto-modo">Cómo se cobra</Label>
            <select id="producto-modo" className="h-8 rounded-lg border bg-transparent px-2" value={modoPrecio} onChange={(e) => onModoPrecio(e.target.value as ModoPrecio)}>
              {(Object.keys(NOMBRE_MODO_PRECIO) as ModoPrecio[]).map((m) => (
                <option key={m} value={m}>
                  {NOMBRE_MODO_PRECIO[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="producto-duracion">Duración en minutos (opcional)</Label>
            <Input id="producto-duracion" inputMode="numeric" placeholder="Ej. 45" value={duracion} onChange={(e) => onDuracion(e.target.value.replace(/\D/g, ""))} />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">{AYUDA[modoPrecio]}</p>
        </div>
      )}
    </div>
  );
}
