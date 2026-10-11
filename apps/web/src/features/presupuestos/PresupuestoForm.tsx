"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputPlata } from "@/components/shared/input-plata";
import { useConfigDocumentos } from "@/features/documentos/use-documentos";
import { BuscadorProductos } from "@/features/productos/components/BuscadorProductos";
import { LineasProductos } from "@/features/productos/components/LineasProductos";
import type { LineaProducto } from "@/features/productos/types";
import { useClientes } from "@/features/ventas/hooks/use-nueva-venta";
import { formatoPesos } from "@/lib/formato";
import { aNumero } from "@/lib/numeros";
import { hoyAR } from "@/lib/periodos";
import { useAccionesPresupuesto, type PresupuestoFicha } from "./use-presupuestos";

const sumarDias = (f: string, n: number) => new Date(Date.parse(`${f}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function lineasDe(p: PresupuestoFicha): LineaProducto[] {
  return p.items.map((i) => ({ clave: `${i.productoId}:${i.varianteId ?? ""}`, productoId: i.productoId, varianteId: i.varianteId, nombre: i.descripcion, variante: null, precioUnitario: i.precioUnitario, cantidad: i.cantidad, stock: 0 }));
}

/** Alta y edición de un presupuesto: cliente, productos con precio editable, descuento, validez y notas. */
export function PresupuestoForm({ inicial, onListo, onCancelar }: { inicial?: PresupuestoFicha; onListo: (id: string) => void; onCancelar?: () => void }) {
  const clientes = useClientes();
  const config = useConfigDocumentos();
  const { crear, editar } = useAccionesPresupuesto();
  const [lineas, setLineas] = useState<LineaProducto[]>(() => (inicial ? lineasDe(inicial) : []));
  const [cliente, setCliente] = useState(inicial?.cliente?.nombre ?? inicial?.clienteNombre ?? "");
  const [descuento, setDescuento] = useState(inicial?.descuento ? String(inicial.descuento) : "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [validez, setValidez] = useState<string | null>(inicial && inicial.validoHasta >= hoyAR() ? inicial.validoHasta : null);
  const [error, setError] = useState<string | null>(null);
  const validezPorDefecto = sumarDias(hoyAR(), config.data?.validezPresupuestoDias ?? 15);
  const guardando = crear.isPending || editar.isPending;

  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0);
  const desc = Math.min(aNumero(descuento), subtotal);
  const elegido = clientes.data?.find((c) => c.nombre.toLowerCase() === cliente.trim().toLowerCase());

  function agregar(nueva: Omit<LineaProducto, "cantidad">) {
    setLineas((prev) => (prev.some((l) => l.clave === nueva.clave) ? prev.map((l) => (l.clave === nueva.clave ? { ...l, cantidad: l.cantidad + 1 } : l)) : [...prev, { ...nueva, cantidad: 1 }]));
  }

  function guardar() {
    if (lineas.length === 0) return setError("Agregá al menos un producto.");
    if (aNumero(descuento) > subtotal) return setError("El descuento no puede ser mayor que el subtotal.");
    setError(null);
    const datos = {
      clienteId: elegido?.id ?? null,
      clienteNombre: elegido ? null : cliente.trim() || null,
      items: lineas.map((l) => ({ productoId: l.productoId, varianteId: l.varianteId, cantidad: l.cantidad, precioUnitario: l.precioUnitario })),
      descuento: desc,
      notas: notas.trim() || null,
      validoHasta: validez,
    };
    const listo = { onSuccess: (p: PresupuestoFicha) => (toast.success(`Presupuesto ${p.numero} guardado`), onListo(p.id)), onError: (e: unknown) => setError(e instanceof Error ? e.message : "No se pudo guardar") };
    if (inicial) editar.mutate({ id: inicial.id, ...datos }, listo);
    else crear.mutate(datos, listo);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <BuscadorProductos onAgregar={agregar} />
          <LineasProductos
            lineas={lineas}
            avisarStock={false}
            vacio="Buscá un producto para agregarlo al presupuesto."
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
            <Label htmlFor="pres-cliente">Cliente</Label>
            <Input id="pres-cliente" list="pres-clientes" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Elegí o escribí un nombre" autoComplete="off" />
            <datalist id="pres-clientes">
              {(clientes.data ?? []).map((c) => (
                <option key={c.id} value={c.nombre} />
              ))}
            </datalist>
            {cliente.trim() && !elegido && <span className="text-xs text-muted-foreground">No está en tus clientes: se guarda solo el nombre.</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pres-descuento">Descuento ($)</Label>
            <InputPlata id="pres-descuento" value={descuento} onChange={(e) => setDescuento(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pres-validez">Válido hasta</Label>
            <Input id="pres-validez" type="date" min={hoyAR()} value={validez ?? validezPorDefecto} onChange={(e) => setValidez(e.target.value || null)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pres-notas">Notas para el cliente</Label>
            <textarea id="pres-notas" rows={3} maxLength={2000} className="rounded-lg border bg-transparent px-3 py-2 text-sm" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Entrega en 7 días. Seña del 50 %." />
          </div>
          <div className="flex flex-col gap-1 border-t pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatoPesos(subtotal)}</span>
            </div>
            {desc > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Descuento</span>
                <span className="tabular-nums">-{formatoPesos(desc)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatoPesos(subtotal - desc)}</span>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="animate-spin" aria-hidden />}
              {inicial ? "Guardar cambios" : "Guardar presupuesto"}
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
