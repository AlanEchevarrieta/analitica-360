"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfiguracionVenta, useUbicaciones } from "@/features/ventas/hooks/use-nueva-venta";
import { FORMAS_PAGO } from "@/features/ventas/types/nueva-venta";
import { useAccionesPedido } from "../hooks/use-pedidos";
import type { PedidoDetalle } from "../types";

type Acciones = ReturnType<typeof useAccionesPedido>;

function errorDe(e: unknown) {
  return e instanceof Error ? e.message : "No se pudo completar la acción";
}

function Despacho({ acciones, onHecho }: { acciones: Acciones; onHecho: () => void }) {
  const ubicaciones = useUbicaciones();
  const config = useConfiguracionVenta();
  const [transportista, setTransportista] = useState("");
  const [seguimiento, setSeguimiento] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [formaPago, setFormaPago] = useState("transferencia");
  const lista = ubicaciones.data ?? [];
  const medios = config.data ? FORMAS_PAGO.filter((f) => config.data.mediosPago.includes(f.valor)) : FORMAS_PAGO;

  function despachar() {
    acciones.despachar.mutate(
      {
        transportista: transportista.trim() || null,
        numeroSeguimiento: seguimiento.trim() || null,
        ubicacionOrigen: lista.length > 1 ? ubicacion || config.data?.ubicacionDefault || lista[0].nombre : null,
        formaPago,
      },
      {
        onSuccess: () => {
          toast.success("Pedido despachado: se registró la venta y se descontó el stock");
          onHecho();
        },
        onError: (e) => toast.error(errorDe(e)),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="despacho-transportista">Transportista</Label>
          <Input id="despacho-transportista" placeholder="Andreani, Correo, moto…" value={transportista} onChange={(e) => setTransportista(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="despacho-seguimiento">N° de seguimiento</Label>
          <Input id="despacho-seguimiento" value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="despacho-pago">Cómo pagó</Label>
          <select id="despacho-pago" className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
            {medios.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </div>
        {lista.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="despacho-ubicacion">Sale de</Label>
            <select
              id="despacho-ubicacion"
              className="h-8 rounded-lg border bg-transparent px-2 text-sm"
              value={ubicacion || config.data?.ubicacionDefault || lista[0].nombre}
              onChange={(e) => setUbicacion(e.target.value)}
            >
              {lista.map((u) => (
                <option key={u.id} value={u.nombre}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Al despachar se registra la venta del pedido y se descuenta el stock.</p>
      <Button onClick={despachar} disabled={acciones.despachar.isPending}>
        {acciones.despachar.isPending && <Loader2 className="animate-spin" aria-hidden />}
        Confirmar despacho
      </Button>
    </div>
  );
}

export function AccionesPedido({ pedido, acciones }: { pedido: PedidoDetalle; acciones: Acciones }) {
  const [despachando, setDespachando] = useState(false);
  const ejecutar = (m: { mutate: (v: undefined, o: { onSuccess: () => void; onError: (e: unknown) => void }) => void }, ok: string) =>
    m.mutate(undefined, { onSuccess: () => toast.success(ok), onError: (e) => toast.error(errorDe(e)) });
  const cancelable = ["nuevo", "en_preparacion", "listo_despacho"].includes(pedido.estado);

  return (
    <div className="flex flex-col gap-2">
      {(pedido.estado === "nuevo" || pedido.estado === "en_preparacion") && (
        <>
          <Button variant="outline" onClick={() => ejecutar(acciones.marcarTodo, "Todo marcado como preparado")}>
            Marcar todo preparado
          </Button>
          <Button onClick={() => ejecutar(acciones.confirmarListo, "Pedido listo para despachar")}>Listo para despachar</Button>
        </>
      )}
      {pedido.estado === "listo_despacho" &&
        (despachando ? (
          <Despacho acciones={acciones} onHecho={() => setDespachando(false)} />
        ) : (
          <Button onClick={() => setDespachando(true)}>Despachar</Button>
        ))}
      {pedido.estado === "despachado" && (
        <Button onClick={() => ejecutar(acciones.conTransportista, "Pedido en manos del transportista")}>Entregado al transportista</Button>
      )}
      {pedido.estado === "con_transportista" && (
        <Button onClick={() => ejecutar(acciones.entregado, "Pedido entregado")}>Marcar entregado</Button>
      )}
      {cancelable && (
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={() => {
            if (window.confirm(`¿Cancelar el pedido ${pedido.numeroPedido}? No se puede deshacer.`)) {
              ejecutar(acciones.cancelar, "Pedido cancelado");
            }
          }}
        >
          Cancelar pedido
        </Button>
      )}
    </div>
  );
}
