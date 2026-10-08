"use client";

import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatoFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { useAccionesPedido } from "../hooks/use-pedidos";
import { ESTADOS, type PedidoDetalle } from "../types";

const diaAR = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const fechaCorta = (dia: string) => dia.split("-").reverse().join("/");

/** Fecha comprometida (para el objetivo "despachos a tiempo") e historia de estados del pedido. */
export function SeguimientoPedido({ p }: { p: PedidoDetalle }) {
  const { fijarFechaComprometida } = useAccionesPedido(p.id);
  const despacho = p.estados.find((e) => e.estado === "despachado");
  const editable = !despacho && p.estado !== "cancelado";
  const diaDespacho = despacho ? diaAR(despacho.fecha) : null;
  const aTiempo = diaDespacho && p.fechaComprometida ? diaDespacho <= p.fechaComprometida : null;

  const cambiar = (fecha: string) =>
    fijarFechaComprometida.mutate(fecha || null, {
      onSuccess: () => toast.success(fecha ? `Comprometido para el ${fechaCorta(fecha)}` : "Sin fecha comprometida"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seguimiento</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pedido-comprometida">Despachar a más tardar el</Label>
          {editable ? (
            <Input id="pedido-comprometida" type="date" className="w-44" defaultValue={p.fechaComprometida ?? ""} disabled={fijarFechaComprometida.isPending} onBlur={(e) => e.target.value !== (p.fechaComprometida ?? "") && cambiar(e.target.value)} />
          ) : (
            <p className="text-sm">
              {p.fechaComprometida ? fechaCorta(p.fechaComprometida) : "Sin fecha comprometida"}
              {aTiempo != null && (
                <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs font-medium", aTiempo ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400")}>
                  {aTiempo ? "Despachado a tiempo" : "Despachado tarde"}
                </span>
              )}
            </p>
          )}
        </div>
        {p.estados.length > 0 && (
          <ol className="flex flex-col gap-2 border-l pl-4">
            {p.estados.map((e, i) => (
              <li key={`${e.estado}-${i}`} className="relative text-sm">
                <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-primary" aria-hidden />
                <span className="font-medium">{ESTADOS.find((x) => x.valor === e.estado)?.etiqueta ?? e.estado}</span>
                <span className="ml-2 text-muted-foreground">{formatoFechaHora(e.fecha)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
