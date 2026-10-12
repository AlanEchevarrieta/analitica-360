"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Eye, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRol } from "@/hooks/use-rol";
import { cn } from "@/lib/utils";
import { bajarDocumento, nombreCategoria, tamanoLegible, useAccionesArchivo, type DocumentoArchivo } from "./use-archivo";

const dia = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

function Vencimiento({ d }: { d: DocumentoArchivo }) {
  if (!d.vence) return null;
  const color = d.estado === "vencido" ? "bg-red-500/15 text-red-600 dark:text-red-400" : d.estado === "por_vencer" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground";
  const texto =
    d.estado === "vencido" ? `Venció el ${dia(d.vence)}` : d.diasParaVencer === 0 ? "Vence hoy" : d.estado === "por_vencer" ? `Vence en ${d.diasParaVencer} días` : `Vence el ${dia(d.vence)}`;
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", color)}>{texto}</span>;
}

function Fila({ d, mostrarEntidad }: { d: DocumentoArchivo; mostrarEntidad: boolean }) {
  const { getToken } = useAuth();
  const esDueno = useRol() === "dueno";
  const { editar, borrar } = useAccionesArchivo();
  const [renovando, setRenovando] = useState(false);
  const [vence, setVence] = useState(d.vence ?? "");

  const ver = async () => {
    const ventana = window.open("", "_blank");
    try {
      const blob = await bajarDocumento(d.id, await getToken());
      const url = URL.createObjectURL(blob);
      if (d.mime === "application/pdf" || d.mime.startsWith("image/")) {
        if (ventana) ventana.location.href = url;
      } else {
        ventana?.close();
        const a = document.createElement("a");
        a.href = url;
        a.download = d.nombre;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      ventana?.close();
      toast.error(e instanceof Error ? e.message : "No se pudo abrir");
    }
  };

  const Icono = d.mime.startsWith("image/") ? ImageIcon : FileText;
  return (
    <li className="flex flex-col gap-2 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Icono className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-40 flex-1">
          <p className="font-medium">{d.titulo}</p>
          <p className="text-xs text-muted-foreground">
            {nombreCategoria(d.categoria)}
            {mostrarEntidad && d.entidadNombre && ` · ${d.entidadTipo === "proveedor" ? "Proveedor" : d.entidadTipo === "cliente" ? "Cliente" : ""} ${d.entidadNombre}`}
            {" · "}
            {tamanoLegible(d.tamano)}
            {d.notas && ` · ${d.notas}`}
          </p>
        </div>
        <Vencimiento d={d} />
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => void ver()} aria-label={`Ver ${d.titulo}`}>
            <Eye aria-hidden /> Ver
          </Button>
          {esDueno && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setRenovando(!renovando)}>
                {d.vence ? "Cambiar vencimiento" : "Agregar vencimiento"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                aria-label={`Borrar ${d.titulo}`}
                disabled={borrar.isPending}
                onClick={() => window.confirm(`¿Borrar "${d.titulo}"? El archivo se elimina.`) && borrar.mutate(d.id, { onSuccess: () => toast.success("Documento borrado"), onError: (e) => toast.error(e.message) })}
              >
                <Trash2 aria-hidden />
              </Button>
            </>
          )}
        </div>
      </div>
      {renovando && (
        <div className="flex flex-wrap items-center gap-2 pl-7">
          <Input type="date" className="h-8 w-44" aria-label={`Vencimiento de ${d.titulo}`} value={vence} onChange={(e) => setVence(e.target.value)} />
          <Button
            size="sm"
            disabled={editar.isPending}
            onClick={() =>
              editar.mutate({ id: d.id, vence: vence || null }, { onSuccess: () => (toast.success("Vencimiento guardado: los avisos vuelven a salir"), setRenovando(false)), onError: (e) => toast.error(e.message) })
            }
          >
            Guardar
          </Button>
          <span className="text-xs text-muted-foreground">¿Lo renovaste? Subí el documento nuevo y borrá este, o cambiá la fecha.</span>
        </div>
      )}
    </li>
  );
}

export function ListaDocumentos({ documentos, mostrarEntidad = false }: { documentos: DocumentoArchivo[]; mostrarEntidad?: boolean }) {
  return (
    <ul className="flex flex-col divide-y text-sm">
      {documentos.map((d) => (
        <Fila key={d.id} d={d} mostrarEntidad={mostrarEntidad} />
      ))}
    </ul>
  );
}
