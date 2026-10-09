"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { RefreshCw, Tag, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { abrirEtiqueta, NOMBRE_ESTADO, useAccionesEnvioPedido, useEnvios } from "./use-envios";

interface Props {
  pedidoId: string;
  estado: string;
  envio: { id: string; estado: string | null } | null;
}

/** En la ficha del pedido: crear el envío en Zipnova, imprimir la etiqueta y ver en qué anda. */
export function EnvioPedido({ pedidoId, estado, envio }: Props) {
  const { data } = useEnvios();
  const { crear, actualizar } = useAccionesEnvioPedido(pedidoId);
  const { getToken } = useAuth();
  if (!data?.disponible || (!data.config?.verificadoEn && !envio)) {
    if (!data?.disponible) return null;
    return (
      <p className="text-xs text-muted-foreground">
        ¿Despachás por correo?{" "}
        <Link href="/configuracion" className="underline">
          Conectá Zipnova
        </Link>{" "}
        y creá el envío y la etiqueta desde acá.
      </p>
    );
  }
  if (!envio && (estado === "cancelado" || estado === "entregado")) return null;

  const etiqueta = async () => {
    try {
      await abrirEtiqueta(pedidoId, await getToken());
    } catch {
      toast.error("No se pudo abrir la etiqueta");
    }
  };
  const error = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo", { duration: 12_000 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="size-4" /> Envío por correo
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {envio ? (
          <>
            <p>
              Envío N° {envio.id} · <b>{envio.estado ? (NOMBRE_ESTADO[envio.estado] ?? envio.estado) : "Creado"}</b>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void etiqueta()}>
                <Tag className="size-4" /> Imprimir etiqueta
              </Button>
              <Button size="sm" variant="ghost" disabled={actualizar.isPending} onClick={() => actualizar.mutate(undefined, { onError: error })}>
                <RefreshCw className="size-4" /> Actualizar estado
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Cuando el correo lo retira y cuando lo entrega, el pedido pasa solo a «con transportista» y «entregado» (si ya lo marcaste como despachado).</p>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">Crea el envío en Zipnova con la forma que eligió el cliente (o la más barata) y deja lista la etiqueta para pegar en el paquete.</p>
            <Button
              disabled={crear.isPending}
              onClick={() =>
                crear.mutate(undefined, {
                  onSuccess: () => toast.success("Envío creado: ya podés imprimir la etiqueta"),
                  onError: error,
                })
              }
            >
              {crear.isPending ? "Creando el envío…" : "Crear envío y etiqueta"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
