"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SinDatos } from "@/components/shared/estado-datos";
import { formatoPesos } from "@/lib/formato";
import type { LineaProducto } from "../types";

export function LineasProductos({
  lineas,
  onCambiar,
  onQuitar,
  etiquetaPrecio = "Precio unitario",
  avisarStock = true,
  vacio = "Buscá un producto para agregarlo a la venta.",
}: {
  /** "Precio unitario" en ventas, "Costo unitario" en compras. */
  etiquetaPrecio?: string;
  /** Avisar si la cantidad supera el stock (solo tiene sentido al vender). */
  avisarStock?: boolean;
  vacio?: string;
  lineas: LineaProducto[];
  onCambiar: (clave: string, cambios: Partial<Pick<LineaProducto, "cantidad" | "precioUnitario">>) => void;
  onQuitar: (clave: string) => void;
}) {
  if (lineas.length === 0) return <SinDatos mensaje={vacio} />;

  return (
    <ul className="flex flex-col divide-y">
      {lineas.map((l) => (
        <li key={l.clave} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-40 flex-1">
            <p className="font-medium">{l.nombre}</p>
            {l.variante && <p className="text-xs text-muted-foreground">{l.variante}</p>}
            {avisarStock && l.cantidad > l.stock && (
              <p className="text-xs text-amber-500">
                Stock disponible: {l.stock}. La venta igual se puede registrar.
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              aria-label={`Restar una unidad de ${l.nombre}`}
              disabled={l.cantidad <= 1}
              onClick={() => onCambiar(l.clave, { cantidad: l.cantidad - 1 })}
            >
              <Minus />
            </Button>
            <Input
              className="w-16 text-center tabular-nums"
              inputMode="numeric"
              aria-label={`Cantidad de ${l.nombre}`}
              value={l.cantidad}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n) && n > 0) onCambiar(l.clave, { cantidad: n });
              }}
            />
            <Button
              size="icon-sm"
              variant="outline"
              aria-label={`Sumar una unidad de ${l.nombre}`}
              onClick={() => onCambiar(l.clave, { cantidad: l.cantidad + 1 })}
            >
              <Plus />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              className="w-28 text-right tabular-nums"
              inputMode="decimal"
              aria-label={`${etiquetaPrecio} de ${l.nombre}`}
              value={l.precioUnitario}
              onChange={(e) => {
                const n = Number(e.target.value.replace(",", "."));
                if (Number.isFinite(n) && n >= 0) onCambiar(l.clave, { precioUnitario: n });
              }}
            />
          </div>
          <span className="w-28 text-right font-medium tabular-nums">
            {formatoPesos(l.cantidad * l.precioUnitario)}
          </span>
          <Button size="icon-sm" variant="ghost" aria-label={`Quitar ${l.nombre}`} onClick={() => onQuitar(l.clave)}>
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}
