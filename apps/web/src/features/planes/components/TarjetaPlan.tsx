"use client";

import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { MODULOS, PLANES, linkContratar, type PlanPagoId } from "../planes";
import type { PrecioCiclo } from "../use-precios";

const POR_CICLO = { mensual: "/ mes", trimestral: "/ trimestre", anual: "/ año" } as const;

/**
 * Un plan con su precio para el ciclo elegido: etiqueta del beneficio, lista
 * tachada, precio final, ahorro en pesos, cuotas sin interés y renovación.
 */
export function TarjetaPlan({ id, precio, codigo, etiqueta, esActual }: { id: PlanPagoId; precio: PrecioCiclo; codigo: string | null; etiqueta: string | null; esActual: boolean }) {
  const plan = PLANES[id];
  const { primerPago: p, renovacion } = precio;
  const conDescuento = p.descuento > 0;
  const cuotas = p.cuotas > 1;
  const detalle = `${conDescuento ? "Primer pago" : "Precio"} ${formatoPesos(p.total)}${cuotas ? ` o ${p.cuotas} cuotas sin interés de ${formatoPesos(p.montoCuota)}` : ""} + IVA`;
  const contratar = linkContratar(id, precio.ciclo, { codigo, detallePrecio: detalle });
  const clase = cn(buttonVariants({ variant: plan.popular ? "default" : "outline" }), "w-full");
  const cambiaAlRenovar = renovacion.total !== p.total || renovacion.cuotas !== p.cuotas;

  return (
    <Card className={cn("relative flex flex-col overflow-visible", plan.popular && "ring-2 ring-primary")}>
      {etiqueta && (
        <span className="absolute -top-3 left-4 rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold tracking-wide text-white shadow-md dark:bg-emerald-500 dark:text-emerald-950">
          {etiqueta}
        </span>
      )}
      <CardHeader className={cn(etiqueta && "pt-7")}>
        <CardTitle className="flex items-center justify-between gap-2 text-lg">
          {plan.nombre}
          {plan.popular && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground">MÁS ELEGIDO</span>}
        </CardTitle>
        {conDescuento && <p className="text-sm text-muted-foreground line-through tabular-nums">{formatoPesos(precio.lista)}</p>}
        <p className="text-3xl font-bold tracking-tight tabular-nums">
          {formatoPesos(p.total)}
          <span className="text-sm font-normal text-muted-foreground"> + IVA {POR_CICLO[precio.ciclo]}</span>
        </p>
        {conDescuento && (
          <p className="w-fit rounded-md bg-emerald-500/15 px-2 py-0.5 text-sm font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
            Ahorrás {formatoPesos(p.descuento)}
          </p>
        )}
        {cuotas && (
          <p className="text-sm font-medium tabular-nums">
            o {p.cuotas} cuotas sin interés de <span className="text-base font-semibold">{formatoPesos(p.montoCuota)}</span>
          </p>
        )}
        {precio.meses > 1 && <p className="text-xs text-muted-foreground tabular-nums">equivale a {formatoPesos(Math.round(p.total / precio.meses))} por mes</p>}
        {cambiaAlRenovar && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Al renovar: {formatoPesos(renovacion.total)} + IVA {POR_CICLO[precio.ciclo]}
            {renovacion.cuotas > 1 ? ` (en ${renovacion.cuotas} cuotas de ${formatoPesos(renovacion.montoCuota)})` : ""}
            {renovacion.descuento > 0 ? ` · ${Math.round((renovacion.descuento / precio.lista) * 100)}% OFF` : ""}
          </p>
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
          <a href={contratar.href} target="_blank" rel="noreferrer" className={clase}>
            Elegir {plan.nombre}
          </a>
        ) : (
          <Link href={contratar.href} className={clase}>
            Elegir {plan.nombre}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
