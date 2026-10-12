"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputPlata } from "@/components/shared/input-plata";
import { BuscadorProductos } from "@/features/productos/components/BuscadorProductos";
import { LineasProductos } from "@/features/productos/components/LineasProductos";
import type { LineaProducto } from "@/features/productos/types";
import { useClientes } from "@/features/ventas/hooks/use-nueva-venta";
import { FORMAS_PAGO } from "@/features/ventas/types/nueva-venta";
import { formatoPesos } from "@/lib/formato";
import { aNumero } from "@/lib/numeros";
import { useAccionesOt, useResponsables, type OrdenTrabajoFicha } from "./use-ordenes-trabajo";

const selectCls = "h-8 rounded-lg border bg-transparent px-2 text-sm";
const areaCls = "rounded-lg border bg-transparent px-3 py-2 text-sm";

function lineasDe(o: OrdenTrabajoFicha): LineaProducto[] {
  return o.items.map((i) => ({ clave: `${i.productoId}:${i.varianteId ?? ""}`, productoId: i.productoId, varianteId: i.varianteId, nombre: i.descripcion, variante: null, precioUnitario: i.precioUnitario, cantidad: i.cantidad, stock: i.stock ?? Number.POSITIVE_INFINITY }));
}

/** Recepción y edición de una orden de trabajo: cliente, equipo, falla, responsable, ítems y seña. */
export function OrdenTrabajoForm({ inicial, onListo, onCancelar }: { inicial?: OrdenTrabajoFicha; onListo: (id: string) => void; onCancelar?: () => void }) {
  const clientes = useClientes();
  const responsables = useResponsables();
  const { crear, editar } = useAccionesOt();
  const [cliente, setCliente] = useState(inicial?.cliente?.nombre ?? inicial?.clienteNombre ?? "");
  const [telefono, setTelefono] = useState(inicial?.clienteTelefono ?? "");
  const [equipo, setEquipo] = useState(inicial?.equipo ?? "");
  const [problema, setProblema] = useState(inicial?.problema ?? "");
  const [notas, setNotas] = useState(inicial?.notasInternas ?? "");
  const [responsableId, setResponsableId] = useState(inicial?.responsableId ?? "");
  const [fechaPrometida, setFechaPrometida] = useState(inicial?.fechaPrometida ?? "");
  const [lineas, setLineas] = useState<LineaProducto[]>(() => (inicial ? lineasDe(inicial) : []));
  const [descuento, setDescuento] = useState(inicial?.descuento ? String(inicial.descuento) : "");
  const [senia, setSenia] = useState("");
  const [formaSenia, setFormaSenia] = useState("efectivo");
  const [error, setError] = useState<string | null>(null);
  const guardando = crear.isPending || editar.isPending;

  const elegido = clientes.data?.find((c) => c.nombre.toLowerCase() === cliente.trim().toLowerCase());
  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0);
  const desc = Math.min(aNumero(descuento), subtotal);

  function agregar(nueva: Omit<LineaProducto, "cantidad">) {
    setLineas((prev) => (prev.some((l) => l.clave === nueva.clave) ? prev.map((l) => (l.clave === nueva.clave ? { ...l, cantidad: l.cantidad + 1 } : l)) : [...prev, { ...nueva, cantidad: 1 }]));
  }

  function guardar() {
    if (!equipo.trim()) return setError("Contá qué deja el cliente (equipo o trabajo).");
    if (aNumero(senia) > 0 && !elegido) return setError("Para registrar una seña, elegí un cliente cargado (queda en su cuenta).");
    setError(null);
    const datos = {
      clienteId: elegido?.id ?? null,
      clienteNombre: elegido ? null : cliente.trim() || null,
      clienteTelefono: telefono.trim() || null,
      equipo: equipo.trim(),
      problema: problema.trim() || null,
      notasInternas: notas.trim() || null,
      responsableId: responsableId || null,
      fechaPrometida: fechaPrometida || null,
      items: lineas.map((l) => ({ productoId: l.productoId, varianteId: l.varianteId, cantidad: l.cantidad, precioUnitario: l.precioUnitario })),
      descuento: desc,
    };
    const listo = { onSuccess: (o: OrdenTrabajoFicha) => (toast.success(`Orden ${o.numero} guardada`), onListo(o.id)), onError: (e: unknown) => setError(e instanceof Error ? e.message : "No se pudo guardar") };
    if (inicial) editar.mutate({ id: inicial.id, ...datos }, listo);
    else crear.mutate({ ...datos, senia: aNumero(senia) > 0 ? { monto: aNumero(senia), formaPago: formaSenia } : null }, listo);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Qué deja el cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ot-cliente">Cliente</Label>
              <Input id="ot-cliente" list="ot-clientes" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Elegí o escribí un nombre" autoComplete="off" disabled={Boolean(inicial?.senia)} />
              <datalist id="ot-clientes">
                {(clientes.data ?? []).map((c) => (
                  <option key={c.id} value={c.nombre} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ot-telefono">Teléfono (para avisarle)</Label>
              <Input id="ot-telefono" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder={elegido ? "El de su ficha" : "Ej. 261 555 1234"} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="ot-equipo">Equipo o trabajo</Label>
              <Input id="ot-equipo" maxLength={300} value={equipo} onChange={(e) => setEquipo(e.target.value)} placeholder="Ej. Notebook Lenovo ThinkPad, con cargador" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="ot-problema">Falla o pedido (sale en el comprobante)</Label>
              <textarea id="ot-problema" rows={2} maxLength={2000} className={areaCls} value={problema} onChange={(e) => setProblema(e.target.value)} placeholder="Ej. No prende. Tiene la pantalla rayada." />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="ot-notas">Notas internas (no las ve el cliente)</Label>
              <textarea id="ot-notas" rows={2} maxLength={2000} className={areaCls} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mano de obra y repuestos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <BuscadorProductos onAgregar={agregar} />
            <LineasProductos
              lineas={lineas}
              vacio="Podés cargarlos ahora o cuando tengas el diagnóstico. Los repuestos descuentan stock al entregar."
              onCambiar={(clave, cambios) => setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)))}
              onQuitar={(clave) => setLineas((prev) => prev.filter((l) => l.clave !== clave))}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ot-responsable">Lo atiende</Label>
            <select id="ot-responsable" className={selectCls} value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
              <option value="">Sin asignar</option>
              {(responsables.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ot-fecha">Para cuándo (opcional)</Label>
            <Input id="ot-fecha" type="date" value={fechaPrometida} onChange={(e) => setFechaPrometida(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ot-descuento">Descuento ($)</Label>
            <InputPlata id="ot-descuento" value={descuento} onChange={(e) => setDescuento(e.target.value)} />
          </div>
          {!inicial && (
            <div className="flex flex-col gap-1.5 rounded-lg border p-3">
              <Label htmlFor="ot-senia">Seña (opcional)</Label>
              <div className="flex gap-2">
                <InputPlata id="ot-senia" value={senia} onChange={(e) => setSenia(e.target.value)} />
                <select aria-label="Medio de pago de la seña" className={selectCls} value={formaSenia} onChange={(e) => setFormaSenia(e.target.value)}>
                  {FORMAS_PAGO.map((f) => (
                    <option key={f.valor} value={f.valor}>
                      {f.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-xs text-muted-foreground">Queda en la cuenta del cliente, con recibo. Al entregar se descuenta del total.</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-3 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatoPesos(subtotal - desc)}</span>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="animate-spin" aria-hidden />}
              {inicial ? "Guardar cambios" : "Recibir"}
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
