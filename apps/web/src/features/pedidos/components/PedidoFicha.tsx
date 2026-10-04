"use client";

import Link from "next/link";
import { MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { formatoFechaHora, formatoPesos } from "@/lib/formato";
import { useAccionesPedido, useColaboradores, usePedido } from "../hooks/use-pedidos";
import { ORIGENES, type PedidoDetalle } from "../types";
import { AccionesPedido } from "./AccionesPedido";
import { EstadoPedidoBadge } from "./EstadoPedidoBadge";
import { PickingPedido } from "./PickingPedido";

/** wa.me necesita el número en formato internacional: un celular argentino de 10 dígitos pasa a 549 + número. */
function whatsapp(p: PedidoDetalle) {
  const digitos = (p.clienteTelefono ?? "").replace(/\D/g, "");
  if (digitos.length < 8) return null;
  const numero = digitos.length === 10 ? `549${digitos}` : digitos;
  const saludo = `Hola${p.clienteNombre ? ` ${p.clienteNombre.split(" ")[0]}` : ""}!`;
  const texto =
    p.estado === "despachado" || p.estado === "con_transportista"
      ? `${saludo} Tu pedido ${p.numeroPedido} ya está en camino${p.transportista ? ` con ${p.transportista}` : ""}.${p.numeroSeguimiento ? ` N° de seguimiento: ${p.numeroSeguimiento}.` : ""}`
      : `${saludo} Te escribimos por tu pedido ${p.numeroPedido}.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="text-right">{valor}</dd>
    </div>
  );
}

export function PedidoFichaVista({ id }: { id: string }) {
  const { data: p, isPending, isError, error, refetch } = usePedido(id);
  const acciones = useAccionesPedido(id);
  const colaboradores = useColaboradores();

  if (isPending) return <CargandoFilas filas={8} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;

  const pickingBloqueado = !["nuevo", "en_preparacion", "listo_despacho"].includes(p.estado);
  const wa = whatsapp(p);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tabular-nums">Pedido {p.numeroPedido}</h1>
        <EstadoPedidoBadge estado={p.estado} />
        <span className="text-sm text-muted-foreground">
          {ORIGENES[p.origen]} · {formatoFechaHora(p.createdAt)}
        </span>
        <span className="ml-auto text-lg font-semibold tabular-nums">{formatoPesos(p.total)}</span>
      </div>

      {(p.descuentos.cupon > 0 || p.descuentos.transferencia > 0 || p.descuentos.ofertas > 0 || p.descuentos.formaPagoTienda) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
          <span>
            Productos <b className="tabular-nums">{formatoPesos(p.descuentos.subtotal)}</b>
            {p.descuentos.ofertas > 0 && <span className="text-muted-foreground"> (ya con {formatoPesos(p.descuentos.ofertas)} de ofertas)</span>}
          </span>
          {p.descuentos.cupon > 0 && (
            <span className="text-emerald-700 dark:text-emerald-400">
              Cupón <b className="font-mono">{p.descuentos.cuponCodigo}</b> −{formatoPesos(p.descuentos.cupon)}
            </span>
          )}
          {p.descuentos.transferencia > 0 && <span className="text-emerald-700 dark:text-emerald-400">Transferencia −{formatoPesos(p.descuentos.transferencia)}</span>}
          {p.descuentos.formaPagoTienda && (
            <span className="text-muted-foreground">Eligió pagar: {p.descuentos.formaPagoTienda === "transferencia" ? "transferencia" : "a coordinar"}</span>
          )}
          <span className="ml-auto">
            A cobrar <b className="tabular-nums">{formatoPesos(p.total)}</b>
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Preparación</CardTitle>
          </CardHeader>
          <CardContent>
            <PickingPedido
              items={p.items}
              bloqueado={pickingBloqueado}
              onPreparar={(item, n) =>
                acciones.prepararItem.mutate(
                  { itemId: item.id, cantidadPreparada: n, preparado: n >= item.cantidad },
                  { onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar") },
                )
              }
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <AccionesPedido pedido={p} acciones={acciones} />
              {p.ventaId && (
                <p className="text-xs text-muted-foreground">
                  Venta registrada al despachar.{" "}
                  <Link href="/ventas" className="underline">
                    Ver ventas
                  </Link>
                </p>
              )}
              <label className="flex flex-col gap-1.5 text-sm">
                Asignado a
                <select
                  className="h-8 rounded-lg border bg-transparent px-2 text-sm"
                  value={p.asignadoAId ?? ""}
                  onChange={(e) => acciones.asignar.mutate(e.target.value || null)}
                >
                  <option value="">Sin asignar</option>
                  {(colaboradores.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cliente y envío</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <dl className="flex flex-col gap-1.5">
                <Dato etiqueta="Cliente" valor={p.clienteNombre} />
                <Dato etiqueta="Teléfono" valor={p.clienteTelefono} />
                <Dato etiqueta="Email" valor={p.clienteEmail} />
                <Dato etiqueta="Dirección" valor={p.direccionEnvio} />
                <Dato etiqueta="Localidad" valor={[p.localidad, p.provincia, p.codigoPostal].filter(Boolean).join(", ") || null} />
                <Dato etiqueta="Envío" valor={p.metodoEnvio} />
                <Dato etiqueta="Transportista" valor={p.transportista} />
                <Dato etiqueta="Seguimiento" valor={p.numeroSeguimiento} />
              </dl>
              {p.notas && <p className="rounded-md bg-muted/50 p-2 text-sm">{p.notas}</p>}
              <div className="flex flex-wrap gap-2">
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <MessageCircle aria-hidden /> Avisar por WhatsApp
                  </a>
                )}
                <Link href={`/pedidos/${p.id}/remito`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Printer aria-hidden /> Remito
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
