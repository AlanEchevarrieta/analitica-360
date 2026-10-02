"use client";

import { useState } from "react";
import { BadgeCheck, Gift } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useSuscripcion } from "@/hooks/use-suscripcion";
import { cn } from "@/lib/utils";
import { CICLOS, ESTADOS_SUSCRIPCION, PLANES, idPlan, type Ciclo } from "../planes";
import { useAplicarCodigo, usePrecios } from "../use-precios";
import { TarjetaPlan } from "./TarjetaPlan";

const fecha = (iso: string) => iso.split("-").reverse().join("/");

function PlanActual() {
  const { data } = useSuscripcion();
  if (!data?.suscripcion) return null;
  const s = data.suscripcion;
  const plan = PLANES[idPlan(s.planNombre)];
  const vencida = data.trialVencido || s.estado === "vencida" || s.estado === "cancelada";
  return (
    <Card size="sm" className={cn(vencida && "ring-destructive/50")}>
      <CardHeader>
        <CardDescription>Tu plan</CardDescription>
        <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
          {data.enTrial ? "Prueba gratis (todo incluido)" : plan.nombre}
          <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", vencida ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-600")}>
            {ESTADOS_SUSCRIPCION[s.estado] ?? s.estado}
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {data.enTrial
            ? `Te quedan ${data.diasRestantes} ${data.diasRestantes === 1 ? "día" : "días"} de prueba con todas las funciones. Elegí un plan para seguir después.`
            : vencida
              ? "Tu plan venció: elegí uno para seguir usando todas las funciones."
              : s.fechaVencimiento
                ? `Vigente hasta el ${fecha(s.fechaVencimiento)}.`
                : "Vigente."}
        </p>
      </CardHeader>
    </Card>
  );
}

export function PlanesVista() {
  const { data: sub } = useSuscripcion();
  const [ciclo, setCiclo] = useState<Ciclo>("mensual");
  const [texto, setTexto] = useState("");
  const [probando, setProbando] = useState("");
  const precios = usePrecios(probando);
  const aplicar = useAplicarCodigo();
  const actual = sub?.suscripcion && !sub.enTrial ? idPlan(sub.suscripcion.planNombre) : null;
  const cupon = precios.data?.cupon ?? null;

  function aplicarCodigo() {
    aplicar.mutate(texto, {
      onSuccess: (r) => {
        toast.success(r.mensaje);
        setTexto("");
        setProbando("");
      },
      onError: (e) => toast.error(e.message),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PlanActual />

      <div className="text-center">
        <h1 className="text-2xl font-semibold">Elegí tu plan</h1>
        <p className="text-muted-foreground">Precios en pesos argentinos. Cambiás o cancelás cuando quieras.</p>
      </div>

      {cupon?.aplicado ? (
        <p className="mx-auto flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          <BadgeCheck className="size-4" aria-hidden />
          Tenés el código <span className="font-mono font-semibold">{cupon.codigo}</span>
          {cupon.camara ? ` de ${cupon.camara}` : ""}: los precios ya incluyen sus beneficios.
        </p>
      ) : (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Input className="min-w-48 flex-1 uppercase placeholder:normal-case" placeholder="¿Tenés un código? (ej. el de tu cámara)" aria-label="Código" value={texto} onChange={(e) => setTexto(e.target.value)} />
            <Button variant="outline" disabled={!texto.trim()} onClick={() => setProbando(texto.trim())}>
              Ver precios
            </Button>
            {probando && cupon && (
              <Button onClick={aplicarCodigo} disabled={aplicar.isPending}>
                Aplicar código
              </Button>
            )}
          </div>
          {probando && precios.data?.aviso && <p className={cn("text-sm", cupon ? "text-amber-600" : "text-destructive")}>{precios.data.aviso}</p>}
          {probando && cupon && (
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <Gift className="size-4" aria-hidden />
              {cupon.camara ? `Código de ${cupon.camara}` : "Código válido"}
              {cupon.diasPrueba && sub?.enTrial ? `: tu prueba gratis pasa a durar ${Math.round(cupon.diasPrueba / 30) === 1 ? "1 mes" : `${cupon.diasPrueba} días`} desde que te registraste` : ""}. Aplicalo para que quede guardado.
            </p>
          )}
        </div>
      )}

      <div className="mx-auto flex rounded-lg border p-1" role="group" aria-label="Forma de pago">
        {CICLOS.map((c) => (
          <Button key={c.id} size="sm" variant={ciclo === c.id ? "default" : "ghost"} aria-pressed={ciclo === c.id} onClick={() => setCiclo(c.id)}>
            {c.nombre}
          </Button>
        ))}
      </div>

      {precios.isError ? (
        <ErrorDatos error={precios.error} onReintentar={() => precios.refetch()} />
      ) : !precios.data ? (
        <CargandoFilas filas={4} />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {precios.data.planes.map((p) => (
            <TarjetaPlan
              key={p.plan}
              id={p.plan}
              precio={p.ciclos.find((c) => c.ciclo === ciclo)!}
              codigo={cupon?.codigo ?? null}
              esActual={actual === p.plan}
            />
          ))}
        </div>
      )}

      <p className="mx-auto max-w-2xl text-center text-xs text-muted-foreground">
        Precios sin IVA (21%), recuperable para responsables inscriptos. Los descuentos de los códigos se calculan sobre el precio de lista y no se acumulan.
      </p>
    </div>
  );
}
