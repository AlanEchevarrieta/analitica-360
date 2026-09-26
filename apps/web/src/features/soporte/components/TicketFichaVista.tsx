"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { formatoFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { CATEGORIAS, PRIORIDADES, useAccionesTicket, useTicket } from "../hooks/use-soporte";
import { EstadoTicketBadge } from "./TicketsListado";

export function TicketFichaVista({ id }: { id: string }) {
  const { data: t, isPending, isError, error, refetch } = useTicket(id);
  const { responder, marcarVisto } = useAccionesTicket();
  const [texto, setTexto] = useState("");

  // Al abrirlo se marca como visto (apaga el aviso de respuesta nueva en el menú).
  const marcar = marcarVisto.mutate;
  const hayRespuestaSinVer = t?.respuestas.some((r) => r.esAdmin && (!t.vistoClienteAt || r.createdAt > t.vistoClienteAt));
  useEffect(() => {
    if (hayRespuestaSinVer) marcar(id);
  }, [hayRespuestaSinVer, id, marcar]);

  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;

  const cerrado = t.estado === "cerrado";

  function enviar() {
    if (!texto.trim()) return;
    responder.mutate(
      { id, contenido: texto.trim() },
      {
        onSuccess: () => {
          setTexto("");
          toast.success("Respuesta enviada");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo enviar"),
      },
    );
  }

  const mensajes = [{ id: "inicial", esAdmin: false, contenido: t.descripcion, createdAt: t.createdAt }, ...t.respuestas];

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>
              {t.numeroTicket} · {t.asunto}
            </CardTitle>
            <EstadoTicketBadge estado={t.estado} />
          </div>
          <CardDescription>
            {CATEGORIAS[t.categoria]} · prioridad {PRIORIDADES[t.prioridad].toLowerCase()} · abierto el {formatoFechaHora(t.createdAt)}
            {t.usuarioNombre ? ` por ${t.usuarioNombre}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {mensajes.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-1", m.esAdmin ? "items-start" : "items-end")}>
              <div className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap", m.esAdmin ? "bg-muted" : "bg-primary text-primary-foreground")}>{m.contenido}</div>
              <span className="text-xs text-muted-foreground">
                {m.esAdmin ? "Soporte Analítica 360" : "Vos"} · {formatoFechaHora(m.createdAt)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {cerrado ? (
        <p className="text-sm text-muted-foreground">Este ticket está cerrado. Si el problema sigue, creá uno nuevo.</p>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <textarea
              className="min-h-24 rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Escribí tu respuesta…"
              aria-label="Respuesta"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <Button className="self-end" onClick={enviar} disabled={responder.isPending || !texto.trim()}>
              {responder.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Responder
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
