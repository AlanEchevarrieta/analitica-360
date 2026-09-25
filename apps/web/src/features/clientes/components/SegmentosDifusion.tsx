"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoFechaHora, formatoPesos } from "@/lib/formato";
import { linkWhatsApp, useAccionesClientes, useDifusiones, useSegmentos, type Segmentos } from "../hooks/use-clientes";

const SEGMENTOS: { id: keyof Segmentos; titulo: string; descripcion: string; mensaje: string }[] = [
  { id: "cumpleanos", titulo: "🎂 Cumpleaños cerca", descripcion: "Cumplen en los próximos días", mensaje: "¡Hola {nombre}! Se viene tu cumple 🎉 Tenemos un regalito para vos: 10% off en tu próxima compra." },
  { id: "enRiesgo", titulo: "⚠️ En riesgo", descripcion: "Hace un tiempo que no compran", mensaje: "¡Hola {nombre}! Hace rato no te vemos. Te cuento que llegaron cosas nuevas que te pueden gustar 🧉" },
  { id: "inactivos", titulo: "💤 Inactivos", descripcion: "Hace mucho que no compran", mensaje: "¡Hola {nombre}! Te extrañamos 🙂 Pasate cuando quieras, tenemos novedades." },
  { id: "vip", titulo: "⭐ VIP", descripcion: "Los que más compran", mensaje: "¡Hola {nombre}! Por ser de nuestros mejores clientes, te avisamos antes que a nadie de las novedades ✨" },
];

export function SegmentosDifusion() {
  const { data, isPending, isError, error, refetch } = useSegmentos();
  const difusiones = useDifusiones();
  const { difusion } = useAccionesClientes();
  const [elegido, setElegido] = useState<keyof Segmentos>("cumpleanos");
  const [mensajes, setMensajes] = useState<Record<string, string>>(() => Object.fromEntries(SEGMENTOS.map((s) => [s.id, s.mensaje])));

  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  const seg = SEGMENTOS.find((s) => s.id === elegido)!;
  const clientes = data[elegido];
  const mensaje = mensajes[elegido];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SEGMENTOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setElegido(s.id)}
            aria-pressed={elegido === s.id}
            className={`rounded-xl border p-3 text-left transition-colors ${elegido === s.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
          >
            <p className="font-medium">{s.titulo}</p>
            <p className="text-2xl font-semibold tabular-nums">{data[s.id].length}</p>
            <p className="text-xs text-muted-foreground">{s.descripcion}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{seg.titulo}</CardTitle>
          <CardDescription>Escribí el mensaje ({"{nombre}"} se reemplaza por el nombre) y mandalo a cada uno por WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <textarea
            className="min-h-20 rounded-lg border bg-transparent p-2 text-sm"
            aria-label="Mensaje"
            value={mensaje}
            onChange={(e) => setMensajes((m) => ({ ...m, [elegido]: e.target.value }))}
          />
          {clientes.length === 0 ? (
            <SinDatos mensaje="No hay clientes en este segmento." />
          ) : (
            <ul className="flex flex-col divide-y text-sm">
              {clientes.map((c) => {
                const link = linkWhatsApp(c.telefono, mensaje.replaceAll("{nombre}", c.nombre.split(" ")[0]));
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="flex-1 font-medium">{c.nombre}</span>
                    <span className="text-muted-foreground">
                      {elegido === "cumpleanos" && c.dias != null ? (c.dias === 0 ? "¡hoy!" : `en ${c.dias} días`) : null}
                      {elegido !== "cumpleanos" && c.dias != null ? `última compra hace ${c.dias} días` : null}
                      {elegido === "vip" && c.totalFacturado != null ? ` · ${formatoPesos(c.totalFacturado)}` : null}
                    </span>
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
                        <MessageCircle aria-hidden /> Enviar
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin teléfono</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {clientes.length > 0 && (
            <Button
              variant="secondary"
              className="self-start"
              disabled={difusion.isPending}
              onClick={() =>
                difusion.mutate(
                  { segmento: elegido, mensaje, cantidad: clientes.length },
                  { onSuccess: () => toast.success("Difusión registrada"), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar") },
                )
              }
            >
              Registrar difusión enviada
            </Button>
          )}
        </CardContent>
      </Card>

      {(difusiones.data ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Difusiones anteriores</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y text-sm">
              {difusiones.data!.map((d) => (
                <li key={d.id} className="flex gap-3 py-2">
                  <span className="w-36 shrink-0 tabular-nums text-muted-foreground">{formatoFechaHora(d.fecha)}</span>
                  <span className="w-28 shrink-0">{SEGMENTOS.find((s) => s.id === d.segmento)?.titulo ?? d.segmento}</span>
                  <span className="flex-1 truncate">{d.mensaje}</span>
                  <span className="tabular-nums">{d.cantidad} clientes</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
