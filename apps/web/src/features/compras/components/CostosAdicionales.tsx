"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DatosAdicionales {
  flete: string;
  impuestos: string;
  otros: string;
  descripcion: string;
}

export const ADICIONALES_VACIOS: DatosAdicionales = { flete: "", impuestos: "", otros: "", descripcion: "" };

/**
 * Mismo reparto que el backend (costoUnitarioConAdicionales en
 * apps/api inventario/costo-promedio.ts): los adicionales se prorratean
 * por subtotal y se suman al costo de cada unidad.
 */
export function costoRealPorUnidad(items: { cantidad: number; costoUnitario: number }[], adicionales: number) {
  const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.costoUnitario, 0);
  if (adicionales <= 0 || subtotal <= 0) return items.map((i) => i.costoUnitario);
  return items.map((i) => Math.round((i.costoUnitario + (i.costoUnitario * adicionales) / subtotal) * 100) / 100);
}

function Campo({
  id,
  etiqueta,
  valor,
  onCambiar,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambiar: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} inputMode="decimal" placeholder="0" value={valor} onChange={(e) => onCambiar(e.target.value)} />
    </div>
  );
}

export function CostosAdicionales({
  datos,
  onCambiar,
}: {
  datos: DatosAdicionales;
  onCambiar: (cambios: Partial<DatosAdicionales>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Campo id="compra-flete" etiqueta="Flete $" valor={datos.flete} onCambiar={(flete) => onCambiar({ flete })} />
        <Campo
          id="compra-impuestos"
          etiqueta="Impuestos $"
          valor={datos.impuestos}
          onCambiar={(impuestos) => onCambiar({ impuestos })}
        />
        <Campo id="compra-otros" etiqueta="Otros $" valor={datos.otros} onCambiar={(otros) => onCambiar({ otros })} />
      </div>
      <Input
        aria-label="Descripción de otros costos"
        placeholder="¿Qué son los otros costos? (opcional)"
        value={datos.descripcion}
        onChange={(e) => onCambiar({ descripcion: e.target.value })}
      />
      <p className="text-xs text-muted-foreground">
        Se reparten entre los productos según lo que pesa cada uno en la compra y suman a su costo.
      </p>
    </div>
  );
}
