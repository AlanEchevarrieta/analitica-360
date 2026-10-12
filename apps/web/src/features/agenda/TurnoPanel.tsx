"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, Check, MessageCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatoPesos } from "@/lib/formato";
import { TurnoForm } from "./TurnoForm";
import { fechaLarga, NOMBRE_ESTADO_TURNO, OCUPAN, useAccionesAgenda, type EstadoTurno, type Turno } from "./use-agenda";

export const COLOR_ESTADO_TURNO: Record<EstadoTurno, string> = {
  reservado: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  confirmado: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  atendido: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  no_vino: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cancelado: "bg-muted text-muted-foreground",
};

/** Ficha de un turno: estado, recordatorio por WhatsApp, cobrar, reprogramar y cancelar. */
export function TurnoPanel({ turno, onCerrar }: { turno: Turno; onCerrar: () => void }) {
  const { estado, recordatorio } = useAccionesAgenda();
  const [reprogramando, setReprogramando] = useState(false);
  const cobrado = Boolean(turno.ventaId);

  if (reprogramando) return <TurnoForm inicial={turno} onListo={() => setReprogramando(false)} />;

  const cambiar = (nuevo: EstadoTurno) =>
    estado.mutate({ id: turno.id, estado: nuevo }, { onSuccess: () => toast.success(`Turno: ${NOMBRE_ESTADO_TURNO[nuevo].toLowerCase()}`), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cambiar") });

  function recordar() {
    // La ventana se abre antes de esperar a la API: si no, el navegador la bloquea.
    const ventana = window.open("", "_blank");
    recordatorio.mutate(turno.id, {
      onSuccess: (r) => {
        if (ventana) ventana.location.href = r.whatsapp;
        if (!r.telefono) toast.info("El turno no tiene teléfono: elegí el contacto en WhatsApp.");
      },
      onError: (e) => (ventana?.close(), toast.error(e instanceof Error ? e.message : "No se pudo armar el recordatorio")),
    });
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <div className="flex flex-col gap-1">
        <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO_TURNO[turno.estado]}`}>{NOMBRE_ESTADO_TURNO[turno.estado]}</span>
        <p className="text-lg font-semibold">{turno.clienteNombre ?? "Sin nombre"}</p>
        <p className="text-sm text-muted-foreground">
          {fechaLarga(turno.inicio.slice(0, 10))}, {turno.inicio.slice(11, 16)} a {turno.fin.slice(11, 16)} · con {turno.recurso}
        </p>
        {turno.servicio && (
          <p className="text-sm">
            {turno.servicio}
            {turno.precio ? ` · ${formatoPesos(turno.precio)}` : ""}
          </p>
        )}
        {turno.clienteTelefono && <p className="text-sm text-muted-foreground">Tel. {turno.clienteTelefono}</p>}
        {turno.notas && <p className="whitespace-pre-wrap rounded-md bg-muted p-2 text-sm">{turno.notas}</p>}
        {turno.origen === "online" && <p className="text-xs text-muted-foreground">Lo reservó el cliente desde la tienda.</p>}
        {turno.recordadoEn && <p className="text-xs text-muted-foreground">Recordatorio enviado el {new Date(turno.recordadoEn).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}.</p>}
      </div>

      {cobrado ? (
        <Link href={`/ventas/${turno.ventaId}`} className={buttonVariants({ variant: "outline" })}>
          <Wallet aria-hidden /> Ver la venta
        </Link>
      ) : (
        <div className="flex flex-col gap-2">
          {OCUPAN.includes(turno.estado) && (
            <>
              <Link href={`/ventas/nueva?turno=${turno.id}&fecha=${turno.inicio.slice(0, 10)}`} className={buttonVariants()}>
                <Wallet aria-hidden /> Cobrar
              </Link>
              <Button variant="outline" onClick={recordar} disabled={recordatorio.isPending}>
                <MessageCircle aria-hidden /> Recordarle por WhatsApp
              </Button>
              <div className="grid grid-cols-2 gap-2">
                {turno.estado === "reservado" && (
                  <Button variant="outline" onClick={() => cambiar("confirmado")} disabled={estado.isPending}>
                    <Check aria-hidden /> Confirmó
                  </Button>
                )}
                {turno.estado !== "atendido" && (
                  <Button variant="outline" onClick={() => cambiar("atendido")} disabled={estado.isPending}>
                    Atendido
                  </Button>
                )}
                <Button variant="outline" onClick={() => cambiar("no_vino")} disabled={estado.isPending}>
                  No vino
                </Button>
                <Button variant="outline" onClick={() => setReprogramando(true)}>
                  <CalendarClock aria-hidden /> Cambiar horario
                </Button>
              </div>
              <Button variant="ghost" className="text-destructive" onClick={() => (cambiar("cancelado"), onCerrar())} disabled={estado.isPending}>
                Cancelar turno
              </Button>
            </>
          )}
          {!OCUPAN.includes(turno.estado) && (
            <Button variant="outline" onClick={() => cambiar("reservado")} disabled={estado.isPending}>
              Volver a reservarlo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
