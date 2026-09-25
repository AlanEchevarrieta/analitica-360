"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { OrganizationProfile } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApiFetch } from "@/hooks/use-api";
import { hoyAR } from "@/lib/periodos";

/** Usuarios de la empresa: invitaciones, roles y bajas los maneja Clerk (organización = empresa). */
export function EquipoConfig() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Invitá por email: la persona recibe un link, crea su cuenta y entra a esta empresa. Rol <b>admin</b> = dueño (ve y configura todo); <b>member</b> = colaborador.
      </p>
      <OrganizationProfile routing="hash" />
    </div>
  );
}

const EXPORTES = [
  { recurso: "ventas", etiqueta: "Ventas" },
  { recurso: "productos", etiqueta: "Productos" },
  { recurso: "inventario", etiqueta: "Inventario" },
  { recurso: "compras", etiqueta: "Compras" },
  { recurso: "clientes", etiqueta: "Clientes" },
  { recurso: "gastos", etiqueta: "Gastos" },
] as const;

/** Filas JSON -> CSV que Excel abre bien (BOM UTF-8, separador ";" como usa Excel en español). */
function aCsv(filas: Record<string, unknown>[]) {
  if (filas.length === 0) return "";
  const columnas = [...new Set(filas.flatMap((f) => Object.keys(f)))];
  const celda = (v: unknown) => {
    const t = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
  };
  return "﻿" + [columnas.join(";"), ...filas.map((f) => columnas.map((c) => celda(f[c])).join(";"))].join("\r\n");
}

export function ExportarConfig() {
  const api = useApiFetch();
  const [descargando, setDescargando] = useState<string | null>(null);

  async function descargar(recurso: string) {
    setDescargando(recurso);
    try {
      const datos = await api<unknown>(`/import-export/exportar/${recurso}`);
      // Algunos exportes traen varias tablas (ventas: cabecera + items): un archivo por tabla.
      const tablas: [string, unknown[]][] = Array.isArray(datos)
        ? [[recurso, datos]]
        : Object.entries((datos ?? {}) as Record<string, unknown>)
            .filter((e): e is [string, unknown[]] => Array.isArray(e[1]))
            .map(([k, v]) => [`${recurso}-${k}`, v]);
      if (tablas.every(([, filas]) => filas.length === 0)) return toast.info("No hay datos para exportar.");
      for (const [nombre, filas] of tablas) {
        if (filas.length === 0) continue;
        const url = URL.createObjectURL(new Blob([aCsv(filas as Record<string, unknown>[])], { type: "text/csv;charset=utf-8" }));
        const a = Object.assign(document.createElement("a"), { href: url, download: `${nombre}-${hoyAR()}.csv` });
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {EXPORTES.map((e) => (
          <Button key={e.recurso} variant="outline" disabled={descargando !== null} onClick={() => void descargar(e.recurso)}>
            {descargando === e.recurso ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} {e.etiqueta}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Se descarga un archivo .csv que abre directo en Excel o Google Sheets.</p>
    </div>
  );
}
