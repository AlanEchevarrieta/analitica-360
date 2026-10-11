"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccionesDocumentos, useConfigDocumentos, type ConfigDocumentos } from "@/features/documentos/use-documentos";

const error = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar");

function Formulario({ c }: { c: ConfigDocumentos }) {
  const { guardarConfig, logo } = useAccionesDocumentos();
  const [pie, setPie] = useState(c.pie ?? "");
  const [validez, setValidez] = useState(String(c.validezPresupuestoDias));
  const logoActual = c.logoUrl ?? c.logoTienda;
  const dias = Number(validez);

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Logo</Label>
        <div className="flex flex-wrap items-center gap-3">
          {logoActual ? (
            // eslint-disable-next-line @next/next/no-img-element -- archivo de la API, no pasa por el optimizador de Next
            <img src={logoActual} alt="Logo" className="size-16 rounded-md border object-contain" />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-md border text-xs text-muted-foreground">Sin logo</div>
          )}
          <label className="cursor-pointer text-sm text-primary hover:underline">
            {logo.isPending ? "Subiendo…" : c.logoUrl ? "Cambiar" : "Subir logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={logo.isPending}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                e.target.value = "";
                if (archivo) logo.mutate(archivo, { onSuccess: () => toast.success("Logo actualizado"), onError: error });
              }}
            />
          </label>
          {c.logoUrl && (
            <Button size="sm" variant="ghost" disabled={logo.isPending} onClick={() => logo.mutate(null, { onSuccess: () => toast.success("Logo quitado"), onError: error })}>
              Quitar
            </Button>
          )}
        </div>
        {!c.logoUrl && c.logoTienda && <p className="text-xs text-muted-foreground">Por ahora se usa el logo de tu tienda online.</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-pie">Texto al pie</Label>
        <Input id="doc-pie" maxLength={300} value={pie} onChange={(e) => setPie(e.target.value)} placeholder="Ej. Gracias por tu compra. Cambios dentro de los 30 días." />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-validez">Validez de los presupuestos (días)</Label>
        <Input id="doc-validez" className="w-28" type="number" min={1} max={365} value={validez} onChange={(e) => setValidez(e.target.value)} />
      </div>

      <p className="text-sm text-muted-foreground">
        El nombre, la dirección, el teléfono y el email salen de{" "}
        <Link href="/configuracion?s=remitente" className="text-primary hover:underline">
          Datos del remitente
        </Link>
        .
      </p>

      <Button
        className="self-start"
        disabled={guardarConfig.isPending || !(dias >= 1 && dias <= 365)}
        onClick={() => guardarConfig.mutate({ pie: pie.trim() || null, validezPresupuestoDias: Math.round(dias) }, { onSuccess: () => toast.success("Guardado"), onError: error })}
      >
        Guardar
      </Button>
    </div>
  );
}

/** Configuración → Documentos: logo y textos del comprobante, el recibo y el presupuesto. */
export function DocumentosConfig() {
  const { data, isPending, isError } = useConfigDocumentos();
  if (isPending) return <Skeleton className="h-48 max-w-xl" />;
  if (isError || !data) return <p className="text-sm text-destructive">No se pudo cargar la configuración de los documentos.</p>;
  return <Formulario c={data} />;
}
