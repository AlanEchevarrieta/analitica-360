"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiFetch } from "@/hooks/use-api";
import { formatoPesos } from "@/lib/formato";

// Espejo de GET /productos/:id/oferta (apps/api modules/tienda/descuentos-admin.ts).
interface Oferta {
  tipo: "porcentaje" | "precio";
  valor: number;
  desde: string | null;
  hasta: string | null;
  estado: "vigente" | "programada" | "vencida";
  precioFinal: number;
  descuentoPct: number;
}

const ESTADO = { vigente: "En oferta ahora", programada: "Programada", vencida: "Vencida (ya no se aplica)" };

/** Oferta del producto en la tienda online: % o precio fijo, con fechas opcionales. */
export function OfertaProducto({ productoId, precioVenta, usaVariantes }: { productoId: string; precioVenta: number | null; usaVariantes: boolean }) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const clave = ["oferta-producto", orgId, productoId];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api<{ oferta: Oferta | null }>(`/productos/${productoId}/oferta`), enabled: Boolean(orgId) });
  const actual = consulta.data?.oferta ?? null;

  const [editando, setEditando] = useState(false);
  const [tipo, setTipo] = useState<"porcentaje" | "precio">("porcentaje");
  const [valor, setValor] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const empezar = () => {
    setTipo(actual?.tipo ?? "porcentaje");
    setValor(actual ? String(actual.valor) : "");
    setDesde(actual?.desde ?? "");
    setHasta(actual?.hasta ?? "");
    setEditando(true);
  };
  const listo = (d: { oferta: Oferta | null }) => {
    queryClient.setQueryData(clave, d);
    setEditando(false);
  };
  const error = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar la oferta");
  const guardar = useMutation({
    mutationFn: () => api<{ oferta: Oferta }>(`/productos/${productoId}/oferta`, { method: "PUT", body: JSON.stringify({ tipo, valor: Number(valor), desde: desde || null, hasta: hasta || null }) }),
    onSuccess: (d) => {
      listo(d);
      toast.success("Oferta guardada");
    },
    onError: error,
  });
  const quitar = useMutation({
    mutationFn: () => api<{ oferta: null }>(`/productos/${productoId}/oferta`, { method: "DELETE" }),
    onSuccess: (d) => {
      listo(d);
      toast.success("Oferta quitada");
    },
    onError: error,
  });

  // Vista previa mientras se escribe.
  const n = Number(valor);
  const previa = precioVenta && n > 0 ? (tipo === "porcentaje" ? Math.round(precioVenta * (1 - n / 100)) : n) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="size-4" aria-hidden /> Oferta en la tienda online
        </CardTitle>
        <CardDescription>Se muestra con el precio tachado y el % de descuento. Si ponés fechas, se activa y se apaga sola.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {consulta.isPending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Cargando" />
        ) : !editando ? (
          actual ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">−{actual.descuentoPct}%</span>
              <span>
                {precioVenta ? <span className="mr-2 text-muted-foreground line-through">{formatoPesos(precioVenta)}</span> : null}
                <b>{formatoPesos(actual.precioFinal)}</b>
              </span>
              <span className="text-muted-foreground">
                {ESTADO[actual.estado]}
                {actual.desde ? ` · desde ${actual.desde.split("-").reverse().join("/")}` : ""}
                {actual.hasta ? ` · hasta ${actual.hasta.split("-").reverse().join("/")}` : ""}
              </span>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={empezar}>
                  Cambiar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => quitar.mutate()} disabled={quitar.isPending}>
                  Quitar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-fit" onClick={empezar} disabled={!precioVenta}>
              {precioVenta ? "Poner en oferta" : "Primero cargá el precio de venta"}
            </Button>
          )
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              guardar.mutate();
            }}
          >
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="tipo-oferta" checked={tipo === "porcentaje"} onChange={() => setTipo("porcentaje")} />% de descuento
              </label>
              <label className={`flex items-center gap-2 ${usaVariantes ? "opacity-50" : ""}`} title={usaVariantes ? "Con variantes, cada una tiene su precio: usá un %" : undefined}>
                <input type="radio" name="tipo-oferta" checked={tipo === "precio"} disabled={usaVariantes} onChange={() => setTipo("precio")} />
                Precio de oferta
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="oferta-valor">{tipo === "porcentaje" ? "Descuento (%)" : "Precio de oferta ($)"}</Label>
                <Input id="oferta-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d.]/g, ""))} autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="oferta-desde">Desde (opcional)</Label>
                <Input id="oferta-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="oferta-hasta">Hasta (opcional)</Label>
                <Input id="oferta-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
            </div>
            {previa != null && precioVenta ? (
              <p className="text-sm text-muted-foreground">
                En la tienda: <span className="line-through">{formatoPesos(precioVenta)}</span> → <b className="text-foreground">{formatoPesos(previa)}</b>
                {previa < precioVenta ? ` (−${Math.round((1 - previa / precioVenta) * 100)}%)` : " — tiene que ser menor que el precio de venta"}
                {usaVariantes ? ". Se aplica igual a cada variante." : ""}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={guardar.isPending || !(n > 0)}>
                {guardar.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Guardar oferta
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
