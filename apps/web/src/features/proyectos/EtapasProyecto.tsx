"use client";

import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AccionesEtapa } from "./AccionesEtapa";
import {
  NOMBRE_APROBACION,
  NOMBRE_ESTADO_ETAPA,
  fechaCortaAR,
  type ProyectoDetalle,
} from "./use-proyectos";

function fechaHoraAprobacion(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EtapasProyecto({ proyecto }: { proyecto: ProyectoDetalle }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Etapas y aprobaciones</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative ml-3 flex flex-col gap-5 border-l pl-5">
          {proyecto.etapas.map((et) => {
            const cerrada = et.estado === "aprobada" || et.estado === "omitida";
            return (
              <li key={et.id} className="relative flex flex-col gap-1.5 text-sm">
                <span
                  className={cn(
                    "absolute -left-[1.65rem] top-0.5 flex size-5 items-center justify-center rounded-full bg-background",
                    et.estado === "aprobada"
                      ? "text-emerald-500"
                      : et.esActual
                        ? "text-primary"
                        : "text-muted-foreground",
                  )}
                >
                  {cerrada ? (
                    <CheckCircle2 className="size-4" />
                  ) : et.estado === "en_revision" || et.estado === "en_curso" ? (
                    <Clock className="size-4" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                </span>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {et.orden}. {et.nombre}
                    </span>
                    <span className="rounded-full border px-2 py-0.5 text-xs">
                      {NOMBRE_ESTADO_ETAPA[et.estado]}
                      {et.estado === "en_revision" && et.falta
                        ? ` · falta ${et.falta === "interna" ? "interna" : "cliente"}`
                        : ""}
                    </span>
                    {et.version > 1 && (
                      <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs">
                        v{et.version}
                      </span>
                    )}
                    {et.atrasada && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                        🔴 Atrasada
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {et.responsableNombre ? `Resp: ${et.responsableNombre}` : "Sin responsable"}
                    {et.fechaObjetivo ? ` · Objetivo: ${fechaCortaAR(et.fechaObjetivo)}` : ""}
                    {` · ${NOMBRE_APROBACION[et.aprobacion]}`}
                  </div>
                </div>

                {et.aprobaciones.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1 rounded-lg bg-muted/40 p-2.5 text-xs">
                    {et.aprobaciones.map((ap) => (
                      <li key={ap.id} className="flex flex-col gap-0.5">
                        <span>
                          {ap.resultado === "aprobada" ? "✅" : "✏️"}{" "}
                          <b>{ap.tipo === "cliente" ? "Cliente" : "Interna"}</b> · {ap.aprobadorNombre} ·{" "}
                          {ap.medio.replace("_", " ")} · v{ap.version} · {fechaHoraAprobacion(ap.aprobadoEn)}
                        </span>
                        {ap.comentario && (
                          <span className="text-muted-foreground">«{ap.comentario}»</span>
                        )}
                        {ap.evidenciaUrl && (
                          <a
                            href={ap.evidenciaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Ver evidencia →
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <AccionesEtapa proyecto={proyecto} etapa={et} />
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
