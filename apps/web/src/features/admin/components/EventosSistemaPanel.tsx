"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { useAccionesAdmin, useEventosAdmin, useResumenEventosAdmin, type EventoAdmin } from "../hooks/use-admin";
import { Indicador, Panel } from "./comunes";

const ESTADOS_EVENTO: Record<EventoAdmin["estado"], { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "bg-amber-500/15 text-amber-400" },
  procesando: { texto: "Procesando", clase: "bg-sky-500/15 text-sky-400" },
  hecho: { texto: "Hecho", clase: "bg-emerald-500/15 text-emerald-400" },
  fallo: { texto: "En fallo", clase: "bg-red-500/15 text-red-400" },
};

const TIPOS_EVENTO = [
  "todos",
  "correo.enviar",
  "informe.enviar",
  "vencimiento.aviso",
  "objetivo.aviso",
  "precio.aviso",
] as const;

function fechaHoraCorta(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Cartel Andon en la portada de Consola → Resumen cuando hay fallos en las últimas 24 h. */
export function AvisoEventosFallidos() {
  const { data } = useResumenEventosAdmin();
  const fallos = data?.fallos24h ?? 0;
  if (fallos <= 0) return null;
  return (
    <Link
      prefetch={false}
      href="/admin/sistema#eventos"
      className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 hover:bg-red-500/15"
    >
      <span className="font-medium">
        ⚠️ {fallos} {fallos === 1 ? "tarea falló" : "tareas fallaron"} en las últimas 24 h.
      </span>{" "}
      Ver en Eventos →
    </Link>
  );
}

/** Panel de cola de eventos y reintentos en Consola → Sistema. */
export function EventosSistemaPanel() {
  const [estado, setEstado] = useState<string>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const resumen = useResumenEventosAdmin();
  const eventos = useEventosAdmin({ estado, tipo });
  const { reintentarEvento, descartarEvento } = useAccionesAdmin();

  const r = resumen.data;
  const lista = eventos.data ?? [];

  return (
    <section id="eventos" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Indicador
          etiqueta="Pendientes"
          valor={r ? formatoNumero(r.pendientes) : "—"}
          detalle="En cola o esperando reintento"
        />
        <Indicador
          etiqueta="En fallo (24 h)"
          valor={r ? formatoNumero(r.fallos24h) : "—"}
          detalle="Agotaron sus reintentos"
          tono={r && r.fallos24h > 0 ? "mal" : "bien"}
        />
        <Indicador
          etiqueta="Hechos hoy (24 h)"
          valor={r ? formatoNumero(r.hechos24h) : "—"}
          detalle="Procesados con éxito"
        />
      </div>

      <Panel
        titulo="Eventos y tareas en segundo plano"
        descripcion="Cola de correos, informes, avisos y automatizaciones (últimos 200)."
        accion={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-8 rounded-lg border bg-transparent px-2 text-xs"
              aria-label="Filtrar por estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="procesando">Procesando</option>
              <option value="fallo">En fallo</option>
              <option value="hecho">Hechos</option>
            </select>
            <select
              className="h-8 rounded-lg border bg-transparent px-2 text-xs"
              aria-label="Filtrar por tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              {TIPOS_EVENTO.map((t) => (
                <option key={t} value={t}>
                  {t === "todos" ? "Todos los tipos" : t}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {eventos.isPending ? (
          <CargandoFilas filas={4} />
        ) : eventos.isError ? (
          <ErrorDatos error={eventos.error} onReintentar={() => eventos.refetch()} />
        ) : lista.length === 0 ? (
          <SinDatos mensaje="No hay eventos para los filtros seleccionados." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Intentos</TableHead>
                <TableHead>Error / Detalle</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((ev) => {
                const badge = ESTADOS_EVENTO[ev.estado] ?? ESTADOS_EVENTO.pendiente;
                const destinatario = typeof ev.datos?.para === "string" ? ev.datos.para : null;
                return (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {fechaHoraCorta(ev.creadoEn)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{ev.tipo}</TableCell>
                    <TableCell className="text-xs">{ev.empresaNombre ?? "Sistema"}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", badge.clase)}>
                        {badge.texto}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {ev.intentos}/{ev.maxIntentos}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={ev.ultimoError ?? destinatario ?? ""}>
                      {ev.ultimoError ? (
                        <span className="text-red-400">{ev.ultimoError}</span>
                      ) : destinatario ? (
                        <span>Para: {destinatario}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(ev.estado === "fallo" || ev.estado === "pendiente") && (
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={reintentarEvento.isPending}
                            onClick={() => reintentarEvento.mutate(ev.id)}
                          >
                            <RotateCcw className="mr-1 size-3" aria-hidden /> Reintentar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                            disabled={descartarEvento.isPending}
                            onClick={() => descartarEvento.mutate(ev.id)}
                          >
                            <Trash2 className="mr-1 size-3" aria-hidden /> Descartar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </section>
  );
}
