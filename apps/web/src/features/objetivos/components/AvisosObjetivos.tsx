"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAvisosObjetivos } from "../hooks/use-objetivos";

/** Objetivos que a este ritmo no llegan (avisos sin leer del usuario). */
export function AvisosObjetivos() {
  const { data, leido } = useAvisosObjetivos();
  if (!data || data.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3" role="status">
      {data.map((a) => (
        <div key={a.id} className="flex items-start gap-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden />
          <p className="flex-1">{a.mensaje}</p>
          <Button size="sm" variant="ghost" onClick={() => leido.mutate(a.id)} disabled={leido.isPending}>
            Entendido
          </Button>
        </div>
      ))}
    </div>
  );
}
