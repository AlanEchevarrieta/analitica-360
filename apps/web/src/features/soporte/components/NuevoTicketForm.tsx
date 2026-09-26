"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIAS, PRIORIDADES, useAccionesTicket, type CategoriaTicket, type PrioridadTicket } from "../hooks/use-soporte";

const MIN_DESCRIPCION = 20;
const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";

/** `inicial`: ticket precompletado (ej. desde Planes, para contratar). */
export function NuevoTicketForm({ inicial }: { inicial?: { asunto: string; descripcion: string; categoria: CategoriaTicket } }) {
  const router = useRouter();
  const { crear } = useAccionesTicket();
  const [asunto, setAsunto] = useState(inicial?.asunto ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [categoria, setCategoria] = useState<CategoriaTicket>(inicial?.categoria ?? "consulta");
  const [prioridad, setPrioridad] = useState<PrioridadTicket>("media");
  const [error, setError] = useState<string | null>(null);

  function enviar() {
    if (!asunto.trim()) return setError("Poné un asunto corto (ej. \"No puedo cargar una compra\").");
    if (descripcion.trim().length < MIN_DESCRIPCION) return setError(`Contanos un poco más (mínimo ${MIN_DESCRIPCION} caracteres) para poder ayudarte.`);
    setError(null);
    crear.mutate(
      { asunto: asunto.trim(), descripcion: descripcion.trim(), categoria, prioridad },
      {
        onSuccess: (t) => {
          toast.success(`Ticket ${t.numeroTicket ?? ""} enviado. Te avisamos cuando respondamos.`);
          router.push(`/soporte/${t.id}`);
        },
        onError: (e) => setError(e instanceof Error ? e.message : "No se pudo enviar el ticket."),
      },
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-asunto">Asunto</Label>
          <Input id="ticket-asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} maxLength={120} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ticket-categoria">Tipo</Label>
            <select id="ticket-categoria" className={selectClase} value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaTicket)}>
              {Object.entries(CATEGORIAS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ticket-prioridad">Prioridad</Label>
            <select id="ticket-prioridad" className={selectClase} value={prioridad} onChange={(e) => setPrioridad(e.target.value as PrioridadTicket)}>
              {Object.entries(PRIORIDADES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-descripcion">¿Qué pasó?</Label>
          <textarea
            id="ticket-descripcion"
            className="min-h-40 rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="Contanos qué estabas haciendo, qué esperabas que pase y qué pasó. Si hay un mensaje de error, copialo."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">{descripcion.trim().length} / mínimo {MIN_DESCRIPCION} caracteres</span>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={enviar} disabled={crear.isPending}>
            {crear.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enviar ticket
          </Button>
          <Button variant="ghost" onClick={() => router.push("/soporte")}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
