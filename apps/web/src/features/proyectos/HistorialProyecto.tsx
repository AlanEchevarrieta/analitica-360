"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProyectoEventoItem } from "./use-proyectos";

const ETIQUETA_EVENTO: Record<string, string> = {
  creado: "creó el proyecto",
  editado: "editó el proyecto",
  etapa_iniciada: "empezó la etapa",
  enviada_revision: "envió a revisión",
  aprobada: "aprobó la etapa",
  cambios: "pidió cambios en la etapa",
  omitida: "omitió la etapa",
  responsable: "actualizó la etapa",
  pausado: "pausó el proyecto",
  reanudado: "reanudó el proyecto",
  terminado: "terminó el proyecto",
  cancelado: "canceló el proyecto",
};

function fechaHora(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistorialProyecto({ eventos }: { eventos: ProyectoEventoItem[] }) {
  if (eventos.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial del proyecto</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y text-xs">
          {eventos.map((ev) => {
            const det = ev.detalle ?? {};
            const etapaNombre = typeof det.etapa === "string" ? ` «${det.etapa}»` : "";
            const version = typeof det.version === "number" ? ` (v${det.version})` : "";
            const comentario =
              typeof det.comentario === "string"
                ? det.comentario
                : typeof det.nota === "string"
                  ? det.nota
                  : typeof det.motivo === "string"
                    ? det.motivo
                    : null;
            return (
              <li key={ev.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div>
                  <b>{ev.usuarioNombre}</b> {ETIQUETA_EVENTO[ev.tipo] ?? ev.tipo}
                  {etapaNombre}
                  {version}
                  {comentario && <span className="text-muted-foreground"> — «{comentario}»</span>}
                </div>
                <span className="text-muted-foreground tabular-nums">{fechaHora(ev.createdAt)}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
