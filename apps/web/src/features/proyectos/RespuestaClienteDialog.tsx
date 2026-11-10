"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAccionesProyecto, type ProyectoEtapaItem } from "./use-proyectos";

export function RespuestaClienteDialog({
  abierto,
  onOpenChange,
  proyectoId,
  etapa,
  clienteNombreDefault,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  proyectoId: string;
  etapa: ProyectoEtapaItem;
  clienteNombreDefault: string | null;
}) {
  const { respuestaCliente } = useAccionesProyecto();
  const [resultado, setResultado] = useState<"aprobada" | "cambios">("aprobada");
  const [aprobadorNombre, setAprobadorNombre] = useState(clienteNombreDefault ?? "");
  const [medio, setMedio] = useState<"whatsapp" | "email" | "reunion" | "en_persona">("whatsapp");
  const [aprobadoEn, setAprobadoEn] = useState(() => new Date().toISOString().slice(0, 16));
  const [comentario, setComentario] = useState("");
  const [evidenciaUrl, setEvidenciaUrl] = useState("");

  const guardar = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!aprobadorNombre.trim()) {
      toast.error("Poné quién aprobó o respondió");
      return;
    }
    if (resultado === "cambios" && !comentario.trim()) {
      toast.error("Contá qué cambios pidió el cliente");
      return;
    }
    if (evidenciaUrl.trim() && !evidenciaUrl.trim().startsWith("https://")) {
      toast.error("El link de evidencia tiene que empezar con https://");
      return;
    }
    respuestaCliente.mutate(
      {
        proyectoId,
        etapaId: etapa.id,
        resultado,
        version: etapa.version,
        aprobadorNombre: aprobadorNombre.trim(),
        medio,
        aprobadoEn: new Date(aprobadoEn).toISOString(),
        comentario: comentario.trim() || null,
        evidenciaUrl: evidenciaUrl.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(resultado === "aprobada" ? "Aprobación del cliente registrada" : "Pedido de cambios registrado");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo guardar"),
      },
    );
  };

  return (
    <Sheet open={abierto} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl p-6">
        <SheetHeader className="p-0">
          <SheetTitle>Registrar respuesta del cliente</SheetTitle>
          <SheetDescription>
            Etapa «{etapa.nombre}» · v{etapa.version}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={guardar} className="mt-4 flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setResultado("aprobada")}
              className={`rounded-lg border px-3 py-2 font-medium ${
                resultado === "aprobada" ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : ""
              }`}
            >
              ✅ Aprobó
            </button>
            <button
              type="button"
              onClick={() => setResultado("cambios")}
              className={`rounded-lg border px-3 py-2 font-medium ${
                resultado === "cambios" ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300" : ""
              }`}
            >
              ✏️ Pidió cambios
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rc-quien">¿Quién respondió?</Label>
              <Input
                id="rc-quien"
                placeholder="Ej. Laura Gómez"
                value={aprobadorNombre}
                onChange={(e) => setAprobadorNombre(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rc-medio">¿Por dónde?</Label>
              <select
                id="rc-medio"
                className="h-9 rounded-lg border bg-transparent px-2 text-sm"
                value={medio}
                onChange={(e) => setMedio(e.target.value as typeof medio)}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="reunion">Reunión</option>
                <option value="en_persona">En persona</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="rc-fecha">Fecha y hora de la respuesta</Label>
            <Input
              id="rc-fecha"
              type="datetime-local"
              value={aprobadoEn}
              onChange={(e) => setAprobadoEn(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="rc-comentario">
              Comentario {resultado === "cambios" ? "(obligatorio)" : "(opcional)"}
            </Label>
            <Input
              id="rc-comentario"
              placeholder={resultado === "cambios" ? "Qué pidió ajustar…" : "Ej. Confirmó por audio de WhatsApp"}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="rc-evidencia">Link de evidencia https:// (opcional)</Label>
            <Input
              id="rc-evidencia"
              placeholder="https://drive.google.com/..."
              value={evidenciaUrl}
              onChange={(e) => setEvidenciaUrl(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={respuestaCliente.isPending}>
              Guardar respuesta
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
