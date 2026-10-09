"use client";

import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useRol } from "@/hooks/use-rol";
import { useAccionesFacturacion, useFacturacion, type ConfigFacturacion, type EstadoFacturacion } from "./use-facturacion";

/** Configuración → Factura electrónica: datos fiscales, guía para delegar en ARCA y verificación. */
export function FacturaElectronicaConfig() {
  const { data, isPending, isError, error, refetch } = useFacturacion();
  if (isPending) return <CargandoFilas filas={4} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  return <Formulario key={data.config?.cuit ?? "nuevo"} estado={data} />;
}

function Formulario({ estado }: { estado: EstadoFacturacion }) {
  const esDueno = useRol() === "dueno";
  const { guardarConfig, verificar } = useAccionesFacturacion();
  const [c, setC] = useState<ConfigFacturacion>(estado.config ?? { cuit: "", razonSocial: "", domicilio: "", inicioActividades: null, iibb: null, puntoVenta: 0 });
  const campo = (k: keyof ConfigFacturacion, etiqueta: string, extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`fe-${k}`}>{etiqueta}</Label>
      <Input
        id={`fe-${k}`}
        value={c[k] == null ? "" : String(c[k])}
        disabled={!esDueno}
        onChange={(e) => setC({ ...c, [k]: k === "puntoVenta" ? Number(e.target.value.replace(/\D/g, "")) || 0 : e.target.value || (k === "iibb" || k === "inicioActividades" ? null : "") })}
        {...extra}
      />
    </div>
  );

  const guardar = () =>
    guardarConfig.mutate(c, {
      onSuccess: () => toast.success("Datos guardados. Ahora tocá «Verificar con ARCA»."),
      onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
    });
  const probar = () =>
    verificar.mutate(undefined, {
      onSuccess: (r) => toast.success(`¡Listo! ARCA acepta tus facturas. Último número emitido: ${r.ultimoNumero}.`),
      onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo verificar", { duration: 15_000 }),
    });

  if (!estado.disponible) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        La factura electrónica está en preparación: muy pronto vas a poder emitir tus Facturas C desde cada venta. Mientras tanto, podés ir haciendo en ARCA los pasos de abajo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {estado.ambiente === "homologacion" && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">Modo de prueba de ARCA: los comprobantes que emitas no tienen validez fiscal.</p>
      )}

      <div className="rounded-xl border p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <ShieldCheck className="size-4 text-primary" /> Antes de empezar, en ARCA (una sola vez)
        </p>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
          <li>Entrá a arca.gob.ar con tu clave fiscal (nivel 3).</li>
          <li>
            En <strong>Administración de puntos de venta y domicilios</strong>, creá un punto de venta del tipo <strong>«Factura Electrónica – Monotributo – Web Services»</strong> y anotá el número.
          </li>
          <li>
            En <strong>Administrador de Relaciones de Clave Fiscal</strong> → «Nueva relación» → servicio <strong>«Facturación Electrónica (wsfe)»</strong> → representante: el CUIT de Analítica 360 (te lo pasamos por soporte) → confirmá.
          </li>
          <li>Volvé acá, completá tus datos y tocá «Verificar con ARCA».</li>
        </ol>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {campo("cuit", "CUIT", { placeholder: "20-12345678-6", inputMode: "numeric" })}
        {campo("puntoVenta", "Punto de venta (Web Services)", { placeholder: "2", inputMode: "numeric" })}
        {campo("razonSocial", "Nombre o razón social", { placeholder: "Como figura en ARCA" })}
        {campo("domicilio", "Domicilio comercial")}
        {campo("inicioActividades", "Inicio de actividades", { type: "date" })}
        {campo("iibb", "Ingresos brutos (opcional)")}
      </div>

      {esDueno ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={guardar} disabled={guardarConfig.isPending}>
            Guardar datos
          </Button>
          {estado.config && (
            <Button variant="outline" onClick={probar} disabled={verificar.isPending}>
              {verificar.isPending ? "Consultando a ARCA…" : "Verificar con ARCA"}
            </Button>
          )}
          {estado.config?.verificadoEn && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" /> Verificado: ya podés facturar desde cada venta
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Solo el dueño puede cambiar estos datos.</p>
      )}
    </div>
  );
}
