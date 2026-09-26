"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSuscripcion } from "@/hooks/use-suscripcion";
import { formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import {
  DESCUENTO_ANUAL,
  DESCUENTO_LANZAMIENTO,
  ESTADOS_SUSCRIPCION,
  MESES_DESCUENTO_LANZAMIENTO,
  MODULOS,
  PLANES,
  PLANES_PAGOS,
  PRECIOS,
  desgloseAnual,
  idPlan,
  linkContratar,
  precioVigente,
  type Ciclo,
} from "../planes";

const pct = (n: number) => `${Math.round(n * 100)}%`;
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
  const [ciclo, setCiclo] = useState<Ciclo>("mensual");
  const { data } = useSuscripcion();
  const actual = data?.suscripcion && !data.enTrial ? idPlan(data.suscripcion.planNombre) : null;

  return (
    <div className="flex flex-col gap-6">
      <PlanActual />

      <div className="flex justify-center">
        <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label="Forma de pago">
          {(["mensual", "anual"] as const).map((c) => (
            <Button key={c} size="sm" variant={ciclo === c ? "default" : "ghost"} aria-pressed={ciclo === c} onClick={() => setCiclo(c)}>
              {c === "mensual" ? "Mensual" : `Anual −${pct(DESCUENTO_ANUAL)}`}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANES_PAGOS.map((id) => {
          const plan = PLANES[id];
          const anual = desgloseAnual(id);
          const contratar = linkContratar(id, ciclo);
          const esActual = actual === id;
          return (
            <Card key={id} className={cn("flex flex-col", plan.popular && "ring-2 ring-primary")}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-lg">
                  {plan.nombre}
                  {plan.popular && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground">MÁS ELEGIDO</span>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground line-through tabular-nums">{formatoPesos(PRECIOS[id].mensual)}</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatoPesos(precioVigente(id))}
                  <span className="text-sm font-normal text-muted-foreground"> + IVA / mes</span>
                </p>
                <span className="w-fit rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600">
                  🔥 −{pct(DESCUENTO_LANZAMIENTO)} los primeros {MESES_DESCUENTO_LANZAMIENTO} meses
                </span>
                {ciclo === "anual" && (
                  <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <span>Meses 1 a 3: {formatoPesos(anual.mes1a3)}/mes</span>
                    <span>Meses 4 a 12: {formatoPesos(anual.mes4a12)}/mes</span>
                    <span className="font-medium text-foreground">Total del año: {formatoPesos(anual.total)} + IVA</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-sm">
                  {plan.usuarios} · {plan.productos}
                </p>
                <ul className="flex flex-1 flex-col gap-1.5 text-sm">
                  {MODULOS.map((m) => {
                    const incluye = plan.modulos.includes(m.id);
                    return (
                      <li key={m.id} className={cn("flex items-center gap-2", !incluye && "text-muted-foreground/60")}>
                        {incluye ? <Check className="size-4 text-emerald-500" aria-label="Incluido" /> : <Minus className="size-4" aria-label="No incluido" />}
                        {m.etiqueta}
                      </li>
                    );
                  })}
                </ul>
                {esActual ? (
                  <span className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none w-full")}>Tu plan actual</span>
                ) : contratar.externo ? (
                  <a href={contratar.href} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: plan.popular ? "default" : "outline" }), "w-full")}>
                    Elegir {plan.nombre}
                  </a>
                ) : (
                  <Link href={contratar.href} className={cn(buttonVariants({ variant: plan.popular ? "default" : "outline" }), "w-full")}>
                    Elegir {plan.nombre}
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mx-auto max-w-2xl text-center text-xs text-muted-foreground">
        Precios sin IVA (21%), recuperable para responsables inscriptos. El descuento de lanzamiento vale los primeros {MESES_DESCUENTO_LANZAMIENTO} meses para
        suscripciones nuevas. En el pago anual, los meses 4 a 12 llevan el descuento anual: los descuentos no se acumulan.
      </p>
    </div>
  );
}
