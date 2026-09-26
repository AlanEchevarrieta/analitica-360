"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatoFechaHora } from "@/lib/formato";
import { nombreRubro } from "@/lib/rubros";
import { cn } from "@/lib/utils";
import { useAccionesAdmin, useAvisosAdmin } from "../hooks/use-admin";
import { Panel } from "./comunes";

/** Registros nuevos (prueba gratis): para escribirles por WhatsApp el primer día. */
export function AvisosRegistro() {
  const { data } = useAvisosAdmin();
  const { marcarAvisos } = useAccionesAdmin();
  const avisos = (data?.avisos ?? []).filter((a) => a.tipo === "registro").slice(0, 8);
  if (avisos.length === 0) return null;
  return (
    <Panel
      titulo={data!.sinLeer > 0 ? `Registros nuevos (${data!.sinLeer} sin ver)` : "Registros nuevos"}
      descripcion="Escribiles el primer día: es cuando más ayuda una mano para arrancar."
      accion={
        data!.sinLeer > 0 && (
          <Button size="sm" variant="outline" onClick={() => marcarAvisos.mutate(undefined)} disabled={marcarAvisos.isPending}>
            Marcar como vistos
          </Button>
        )
      }
    >
      <ul className="flex flex-col divide-y">
        {avisos.map((a) => {
          const d = a.detalle;
          const wa = d.telefono ? `https://wa.me/${d.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${d.dueno?.split(" ")[0] ?? ""}! Soy Alan de Analítica 360, vi que te registraste. ¿Te ayudo a cargar tus productos?`)}` : null;
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              {!a.leido && <span className="size-2 rounded-full bg-primary" aria-label="Sin ver" />}
              <div className="min-w-0 flex-1">
                {a.empresaId ? (
                  <Link href={`/admin/clientes/${a.empresaId}`} className="font-medium hover:underline">
                    {d.nombre ?? a.titulo}
                  </Link>
                ) : (
                  <span className="font-medium">{d.nombre ?? a.titulo}</span>
                )}
                <span className="text-muted-foreground"> · {nombreRubro(d.rubro)}</span>
                <span className="block text-xs text-muted-foreground">
                  {[d.dueno, d.email, d.origen && `nos conoció por ${d.origen}`, formatoFechaHora(a.createdAt)].filter(Boolean).join(" · ")}
                </span>
              </div>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                  <MessageCircle aria-hidden /> WhatsApp
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
