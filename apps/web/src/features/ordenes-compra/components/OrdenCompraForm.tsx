"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProveedores } from "@/features/compras/hooks/use-compras";
import { BuscadorProductos } from "@/features/productos/components/BuscadorProductos";
import { LineasProductos } from "@/features/productos/components/LineasProductos";
import type { LineaProducto } from "@/features/productos/types";
import { formatoPesos } from "@/lib/formato";
import { hoyAR } from "@/lib/periodos";
import { useAccionesOrdenCompra, type OrdenCompraFicha } from "../hooks/use-ordenes-compra";

const selectCls = "h-8 rounded-lg border bg-transparent px-2 text-sm";

function lineasDe(o: OrdenCompraFicha): LineaProducto[] {
  return o.items.map((i) => ({ clave: `${i.productoId}:${i.varianteId ?? ""}`, productoId: i.productoId, varianteId: i.varianteId, nombre: i.productoNombre, variante: i.varianteEtiqueta, precioUnitario: i.precioUnitario, cantidad: i.cantidadPedida, stock: 0 }));
}

/** Alta y edición de una orden de compra: proveedor, productos con su costo, entrega estimada y notas. */
export function OrdenCompraForm({ inicial, onListo, onCancelar }: { inicial?: OrdenCompraFicha; onListo: (id: string) => void; onCancelar?: () => void }) {
  const proveedores = useProveedores();
  const { crear, editar } = useAccionesOrdenCompra();
  const [lineas, setLineas] = useState<LineaProducto[]>(() => (inicial ? lineasDe(inicial) : []));
  const [proveedorId, setProveedorId] = useState(inicial?.proveedorId ?? "");
  const [entrega, setEntrega] = useState(inicial?.fechaEntregaEstimada?.slice(0, 10) ?? "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const guardando = crear.isPending || editar.isPending;
  const total = lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0);

  function agregar(nueva: Omit<LineaProducto, "cantidad">) {
    setLineas((prev) => (prev.some((l) => l.clave === nueva.clave) ? prev.map((l) => (l.clave === nueva.clave ? { ...l, cantidad: l.cantidad + 1 } : l)) : [...prev, { ...nueva, cantidad: 1 }]));
  }

  function guardar(estado: "borrador" | "enviada") {
    if (lineas.length === 0) return setError("Agregá al menos un producto.");
    setError(null);
    const datos = {
      proveedorId: proveedorId || null,
      fechaEntregaEstimada: entrega || null,
      notas: notas.trim() || null,
      // Editando una ya enviada o confirmada, no se manda el estado: la API mantiene el que tenía.
      estado: inicial && inicial.estado !== "borrador" ? undefined : estado,
      items: lineas.map((l) => ({ productoId: l.productoId, varianteId: l.varianteId, cantidadPedida: l.cantidad, precioUnitario: l.precioUnitario })),
    };
    const listo = { onSuccess: (o: OrdenCompraFicha) => (toast.success(`Orden ${o.numeroOc} guardada`), onListo(o.id)), onError: (e: unknown) => setError(e instanceof Error ? e.message : "No se pudo guardar") };
    if (inicial) editar.mutate({ id: inicial.id, ...datos }, listo);
    else crear.mutate(datos, listo);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>Productos a pedir</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <BuscadorProductos onAgregar={agregar} precioDe={(producto, variante) => variante?.costo ?? producto.costo ?? 0} mostrar="costo" tipo="todos" />
          <LineasProductos
            lineas={lineas}
            etiquetaPrecio="Costo unitario"
            avisarStock={false}
            vacio="Buscá los productos que le vas a pedir al proveedor."
            onCambiar={(clave, cambios) => setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)))}
            onQuitar={(clave) => setLineas((prev) => prev.filter((l) => l.clave !== clave))}
          />
        </CardContent>
      </Card>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oc-proveedor">Proveedor</Label>
            <select id="oc-proveedor" className={selectCls} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Sin proveedor</option>
              {(proveedores.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oc-entrega">Entrega estimada</Label>
            <Input id="oc-entrega" type="date" min={hoyAR()} value={entrega} onChange={(e) => setEntrega(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oc-notas">Notas para el proveedor</Label>
            <textarea id="oc-notas" rows={3} maxLength={2000} className="rounded-lg border bg-transparent px-3 py-2 text-sm" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Entregar en el local de 9 a 13." />
          </div>
          <div className="flex justify-between border-t pt-3 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatoPesos(total)}</span>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {(!inicial || inicial.estado === "borrador") && (
              <Button onClick={() => guardar("enviada")} disabled={guardando}>
                {guardando && <Loader2 className="animate-spin" aria-hidden />}
                Guardar y marcar enviada
              </Button>
            )}
            <Button variant={!inicial || inicial.estado === "borrador" ? "outline" : "default"} onClick={() => guardar("borrador")} disabled={guardando}>
              {inicial && inicial.estado !== "borrador" ? "Guardar cambios" : "Guardar borrador"}
            </Button>
            {onCancelar && (
              <Button variant="ghost" onClick={onCancelar} disabled={guardando}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
