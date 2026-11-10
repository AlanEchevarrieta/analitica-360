"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RespuestaClienteDialog } from "./RespuestaClienteDialog";
import {
  mensajePedidoAprobacionWeb,
  useAccionesProyecto,
  type ProyectoDetalle,
  type ProyectoEtapaItem,
} from "./use-proyectos";

export function AccionesEtapa({
  proyecto,
  etapa,
}: {
  proyecto: ProyectoDetalle;
  etapa: ProyectoEtapaItem;
}) {
  const { accionEtapa, aprobacionInterna } = useAccionesProyecto();
  const [modalCliente, setModalCliente] = useState(false);
  const [modoNota, setModoNota] = useState<null | "omitir" | "cambios_internos">(null);
  const [textoNota, setTextoNota] = useState("");

  if (proyecto.estado !== "activo") return null;
  if (etapa.estado === "aprobada" || etapa.estado === "omitida") return null;

  const ejecutarAccion = (accion: "empezar" | "enviar_revision" | "terminar" | "omitir", nota?: string) => {
    accionEtapa.mutate(
      { proyectoId: proyecto.id, etapaId: etapa.id, accion, nota },
      {
        onSuccess: () => {
          toast.success("Etapa actualizada");
          setModoNota(null);
          setTextoNota("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar la etapa"),
      },
    );
  };

  const ejecutarInterna = (resultado: "aprobada" | "cambios", comentario?: string) => {
    aprobacionInterna.mutate(
      {
        proyectoId: proyecto.id,
        etapaId: etapa.id,
        resultado,
        version: etapa.version,
        comentario,
      },
      {
        onSuccess: () => {
          toast.success(resultado === "aprobada" ? "Aprobación interna registrada" : "Se pidieron cambios");
          setModoNota(null);
          setTextoNota("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
      },
    );
  };

  const textoWa = mensajePedidoAprobacionWeb({
    cliente: proyecto.clienteNombre,
    proyecto: proyecto.nombre,
    etapa: etapa.nombre,
    version: etapa.version,
    negocio: proyecto.negocioNombre,
  });
  const telLimpio = (proyecto.clienteTelefono ?? "").replace(/\D/g, "");
  const urlWa = `https://wa.me/${telLimpio}?text=${encodeURIComponent(textoWa)}`;

  const esperaInterna =
    etapa.estado === "en_revision" &&
    (etapa.aprobacion === "interna" || (etapa.aprobacion === "ambas" && etapa.falta === "interna"));
  const esperaCliente =
    etapa.estado === "en_revision" &&
    (etapa.aprobacion === "cliente" || (etapa.aprobacion === "ambas" && etapa.falta === "cliente"));

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {etapa.estado === "pendiente" && etapa.esActual && (
          <Button size="sm" onClick={() => ejecutarAccion("empezar")} disabled={accionEtapa.isPending}>
            Empezar
          </Button>
        )}

        {etapa.estado === "en_curso" && etapa.aprobacion === "ninguna" && (
          <Button size="sm" onClick={() => ejecutarAccion("terminar")} disabled={accionEtapa.isPending}>
            Terminar etapa
          </Button>
        )}

        {etapa.estado === "en_curso" && etapa.aprobacion !== "ninguna" && (
          <Button size="sm" onClick={() => ejecutarAccion("enviar_revision")} disabled={accionEtapa.isPending}>
            Enviar a revisión (v{etapa.version})
          </Button>
        )}

        {esperaInterna && (
          <>
            <Button
              size="sm"
              onClick={() => ejecutarInterna("aprobada")}
              disabled={aprobacionInterna.isPending}
            >
              Aprobar internamente
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModoNota("cambios_internos")}
              disabled={aprobacionInterna.isPending}
            >
              Pedir cambios
            </Button>
          </>
        )}

        {esperaCliente && (
          <>
            <Button size="sm" onClick={() => setModalCliente(true)}>
              Registrar respuesta del cliente
            </Button>
            <a
              href={urlWa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-muted"
            >
              <MessageCircle className="size-3.5 text-emerald-500" aria-hidden /> Pedir aprobación por WhatsApp
            </a>
          </>
        )}

        {(etapa.estado === "pendiente" || etapa.estado === "en_curso") && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground"
            onClick={() => setModoNota("omitir")}
          >
            Omitir etapa
          </Button>
        )}
      </div>

      {modoNota && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <Input
            className="h-8 flex-1 text-xs"
            placeholder={
              modoNota === "omitir" ? "Motivo para omitir esta etapa…" : "Qué cambios hay que hacer…"
            }
            value={textoNota}
            onChange={(e) => setTextoNota(e.target.value)}
          />
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!textoNota.trim()}
            onClick={() =>
              modoNota === "omitir"
                ? ejecutarAccion("omitir", textoNota)
                : ejecutarInterna("cambios", textoNota)
            }
          >
            Confirmar
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setModoNota(null)}>
            Cancelar
          </Button>
        </div>
      )}

      <RespuestaClienteDialog
        abierto={modalCliente}
        onOpenChange={setModalCliente}
        proyectoId={proyecto.id}
        etapa={etapa}
        clienteNombreDefault={proyecto.clienteNombre}
      />
    </div>
  );
}
