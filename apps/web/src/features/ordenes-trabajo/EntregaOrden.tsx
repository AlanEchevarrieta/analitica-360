"use client";

import { useState } from "react";
import { Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useUbicaciones } from "@/features/ventas/hooks/use-nueva-venta";
import { FORMAS_PAGO } from "@/features/ventas/types/nueva-venta";
import { formatoPesos } from "@/lib/formato";
import { useAccionesOt, type OrdenTrabajoFicha } from "./use-ordenes-trabajo";

const selectCls = "h-8 rounded-lg border bg-transparent px-2 text-sm";

/** Entregar: arma la venta por el total, cobra lo que falta y le aplica la seña. */
export function EntregaOrden({ orden, onListo }: { orden: OrdenTrabajoFicha; onListo: () => void }) {
  const { entregar } = useAccionesOt();
  const ubicaciones = useUbicaciones();
  const [forma, setForma] = useState("efectivo");
  const [ubicacion, setUbicacion] = useState("");
  const lugares = ubicaciones.data ?? [];
  const faltaStock = orden.items.some((i) => i.stock != null && i.cantidad > i.stock);
  const seniaCubre = orden.senia != null && orden.saldo <= 0;

  const confirmar = () =>
    entregar.mutate(
      { id: orden.id, formaPago: forma, ubicacionOrigen: lugares.length > 1 ? ubicacion || lugares[0].nombre : null },
      { onSuccess: (o) => (toast.success(`Entregada: venta ${o.numeroVenta} registrada`), onListo()), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo entregar", { duration: 12_000 }) },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageCheck className="size-4" /> Entregar y cobrar
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <span>
            Total <span className="font-medium tabular-nums">{formatoPesos(orden.total)}</span>
          </span>
          {orden.senia && (
            <span className="text-muted-foreground">
              Seña ya cobrada: <span className="tabular-nums">{formatoPesos(orden.senia.monto)}</span>
            </span>
          )}
          <span className="text-base font-semibold">
            Falta cobrar <span className="tabular-nums">{formatoPesos(orden.saldo)}</span>
          </span>
        </div>
        {!seniaCubre && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ot-forma">Cómo paga lo que falta</Label>
            <select id="ot-forma" className={selectCls} value={forma} onChange={(e) => setForma(e.target.value)}>
              {FORMAS_PAGO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.etiqueta}
                </option>
              ))}
              {orden.clienteId && <option value="cuenta_corriente">A cuenta (fiado)</option>}
            </select>
          </div>
        )}
        {lugares.length > 1 && orden.items.some((i) => i.stock != null) && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ot-ubicacion">Los repuestos salen de</Label>
            <select id="ot-ubicacion" className={selectCls} value={ubicacion || lugares[0].nombre} onChange={(e) => setUbicacion(e.target.value)}>
              {lugares.map((u) => (
                <option key={u.nombre} value={u.nombre}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        {faltaStock && <p className="text-amber-600 dark:text-amber-400">Falta stock de algún repuesto: la venta igual se registra.</p>}
        <p className="text-xs text-muted-foreground">Se registra la venta (los repuestos descuentan stock) y la seña se cuenta en la caja el día que entró.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onListo} disabled={entregar.isPending}>
            Volver
          </Button>
          <Button onClick={confirmar} disabled={entregar.isPending || orden.items.length === 0}>
            {entregar.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Entregar
          </Button>
        </div>
        {orden.items.length === 0 && <p className="text-xs text-destructive">Primero cargá la mano de obra y los repuestos (Editar).</p>}
      </CardContent>
    </Card>
  );
}
