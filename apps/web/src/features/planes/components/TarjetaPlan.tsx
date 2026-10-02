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

/** Un plan con su precio para el ciclo elegido: lista tachada, primer pago con descuento, cuotas y renovación. */
export function TarjetaPlan({ id, precio, codigo, esActual }: { id: PlanPagoId; precio: PrecioCiclo; codigo: string | null; esActual: boolean }) {
  const plan = PLANES[id];
  const { primerPago: p, renovacion } = precio;
  const conDescuento = p.descuento > 0;
  const cuotas = p.cuotas > 1;
  const detalle = `${conDescuento ? "Primer pago" : "Precio"} ${formatoPesos(p.total)}${cuotas ? ` o ${p.cuotas} cuotas de ${formatoPesos(p.montoCuota)}` : ""} + IVA`;
  const contratar = linkContratar(id, precio.ciclo, { codigo, detallePrecio: detalle });
  const clase = cn(buttonVariants({ variant: plan.popular ? "default" : "outline" }), "w-full");

  return (
    <Card className={cn("flex flex-col", plan.popular && "ring-2 ring-primary")}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-lg">
          {plan.nombre}
          {plan.popular && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground">MÁS ELEGIDO</span>}
        </CardTitle>
        {conDescuento && <p className="text-sm text-muted-foreground line-through tabular-nums">{formatoPesos(precio.lista)}</p>}
        <p className="text-2xl font-semibold tabular-nums">
          {formatoPesos(p.total)}
          <span className="text-sm font-normal text-muted-foreground"> + IVA {POR_CICLO[precio.ciclo]}</span>
        </p>
        {precio.meses > 1 && <p className="text-xs text-muted-foreground tabular-nums">equivale a {formatoPesos(Math.round(p.total / precio.meses))} por mes</p>}
        {cuotas && <p className="text-sm font-medium tabular-nums">o {p.cuotas} cuotas de {formatoPesos(p.montoCuota)}</p>}
        {conDescuento && (
          <span className="w-fit rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-600">
            {p.tipo === "entrada" ? "Primer pago" : "Con tu código"}: {Math.round((p.descuento / precio.lista) * 100)}% OFF
          </span>
        )}
        {(conDescuento || renovacion.descuento > 0) && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Al renovar: {formatoPesos(renovacion.total)} + IVA {POR_CICLO[precio.ciclo]}
            {renovacion.descuento > 0 ? ` (${Math.round((renovacion.descuento / precio.lista) * 100)}% OFF)` : " (precio de lista)"}
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
