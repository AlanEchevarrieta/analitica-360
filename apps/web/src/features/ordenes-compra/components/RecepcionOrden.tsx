"use client";

import { useState } from "react";
import { Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUbicaciones } from "@/features/ventas/hooks/use-nueva-venta";
import { formatoPesos } from "@/lib/formato";
import { useAccionesOrdenCompra, type OrdenCompraFicha } from "../hooks/use-ordenes-compra";

/**
 * Registrar lo que llegó: suma el stock, actualiza el costo promedio y crea la
 * compra. Se puede recibir en partes; lo que falta queda pendiente.
 */
export function RecepcionOrden({ orden, onListo }: { orden: OrdenCompraFicha; onListo: () => void }) {
  const { recibir } = useAccionesOrdenCompra();
  const ubicaciones = useUbicaciones();
  const pendientes = orden.items.filter((i) => i.cantidadRecibida < i.cantidadPedida);
  const [cantidades, setCantidades] = useState<Record<string, string>>(() => Object.fromEntries(pendientes.map((i) => [i.id, String(i.cantidadPedida - i.cantidadRecibida)])));
  const [ubicacion, setUbicacion] = useState("");
  const lugares = ubicaciones.data ?? [];
  const numero = (id: string) => Math.max(0, Number((cantidades[id] ?? "").replace(",", ".")) || 0);
  const total = pendientes.reduce((s, i) => s + Math.min(numero(i.id), i.cantidadPedida - i.cantidadRecibida) * i.precioUnitario, 0);

  const confirmar = () => {
    const pedido = Object.fromEntries(pendientes.map((i) => [i.id, numero(i.id)]).filter(([, n]) => (n as number) > 0));
    if (Object.keys(pedido).length === 0) return toast.error("Escribí cuánto llegó de al menos un producto");
    recibir.mutate(
      { id: orden.id, cantidades: pedido, ubicacionDestino: lugares.length > 1 ? ubicacion || lugares[0].nombre : null },
      { onSuccess: (o) => (toast.success(o.estado === "recibida" ? "Orden recibida completa: el stock ya se sumó" : "Recepción registrada: el stock ya se sumó"), onListo()), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar") },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageCheck className="size-4" /> ¿Qué llegó?
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">Suma el stock, actualiza el costo de cada producto y queda como compra. Si llegó una parte, lo que falta sigue pendiente.</p>
        <ul className="flex flex-col divide-y">
          {pendientes.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-40 flex-1">
                {i.productoNombre}
                {i.varianteEtiqueta && <span className="text-muted-foreground"> ({i.varianteEtiqueta})</span>}
                <span className="block text-xs text-muted-foreground">
                  Faltan {i.cantidadPedida - i.cantidadRecibida} de {i.cantidadPedida}
                </span>
              </span>
              <Input className="h-8 w-24" inputMode="decimal" aria-label={`Cantidad que llegó de ${i.productoNombre}`} value={cantidades[i.id] ?? ""} onChange={(e) => setCantidades((c) => ({ ...c, [i.id]: e.target.value }))} />
            </li>
          ))}
        </ul>
        {lugares.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oc-ubicacion">Entra a</Label>
            <select id="oc-ubicacion" className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={ubicacion || lugares[0].nombre} onChange={(e) => setUbicacion(e.target.value)}>
              {lugares.map((u) => (
                <option key={u.nombre} value={u.nombre}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span>
            Compra por <span className="font-semibold tabular-nums">{formatoPesos(total)}</span>
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onListo} disabled={recibir.isPending}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={recibir.isPending}>
              {recibir.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Registrar lo que llegó
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
