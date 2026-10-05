"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Gift } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useSuscripcion } from "@/hooks/use-suscripcion";
import { cn } from "@/lib/utils";
import { ESTADOS_SUSCRIPCION, PLANES, idPlan, type Ciclo } from "../planes";
import { useAplicarCodigo, usePrecios, type CuotasEnCurso } from "../use-precios";
import { formatoPesos } from "@/lib/formato";
import { hoyAR } from "@/lib/periodos";
import { CartelBeneficios } from "./CartelBeneficios";
import { SelectorCiclo } from "./SelectorCiclo";
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

/** "Pagás en 3 cuotas de $X — vas por la cuota 2 de 3". */
function AvisoCuotas({ c }: { c: CuotasEnCurso }) {
  const vencida = c.proxima.vence < hoyAR();
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl p-4 text-sm ring-1", vencida ? "bg-destructive/10 ring-destructive/30" : "bg-muted/50 ring-border")}>
      <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden />
      <span>
        Pagás en <strong>{c.cuotas} cuotas sin interés de {formatoPesos(c.montoCuota)}</strong>. Ya pagaste {c.pagadas} de {c.cuotas}.
      </span>
      <span className={cn("text-muted-foreground", vencida && "font-medium text-destructive")}>
        Cuota {c.proxima.numero}: {formatoPesos(c.proxima.monto)} · {vencida ? "venció" : "vence"} el {fecha(c.proxima.vence)}
      </span>
    </div>
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
      {precios.data?.cuotasEnCurso && <AvisoCuotas c={precios.data.cuotasEnCurso} />}
      <AvisoReferidos pct={precios.data?.planes[0]?.ciclos[0]?.primerPago.referidosPct ?? 0} />

      <div className="text-center">
        <h1 className="text-2xl font-semibold">Elegí tu plan</h1>
        <p className="text-muted-foreground">Precios en pesos argentinos. Cambiás o cancelás cuando quieras.</p>
      </div>

      {cupon && precios.data?.beneficios && (
        <CartelBeneficios
          className="mx-auto w-full max-w-3xl"
          codigo={cupon.codigo}
          camara={cupon.camara}
          beneficios={precios.data.beneficios.lista}
          aplicado={cupon.aplicado}
        />
      )}

      {!cupon?.aplicado && (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Input className="min-w-48 flex-1 uppercase placeholder:normal-case" placeholder="¿Tenés un código? (ej. el de tu cámara)" aria-label="Código" value={texto} onChange={(e) => setTexto(e.target.value)} />
            <Button variant="outline" disabled={!texto.trim()} onClick={() => setProbando(texto.trim())}>
              Ver beneficios
            </Button>
            {probando && cupon && (
              <Button onClick={aplicarCodigo} disabled={aplicar.isPending}>
                Aplicar código
              </Button>
            )}
          </div>
          {probando && precios.data?.aviso && <p className={cn("text-sm", cupon ? "text-amber-600" : "text-destructive")}>{precios.data.aviso}</p>}
          {probando && cupon && <p className="text-xs text-muted-foreground">Tocá «Aplicar código» para que quede guardado en tu cuenta.</p>}
        </div>
      )}

      <SelectorCiclo ciclo={ciclo} onChange={setCiclo} tabla={precios.data} beneficios={precios.data?.beneficios ?? null} />

      {precios.isError ? (
        <ErrorDatos error={precios.error} onReintentar={() => precios.refetch()} />
      ) : !precios.data ? (
        <CargandoFilas filas={4} />
      ) : (
        <div className="grid gap-6 pt-2 md:grid-cols-3 md:gap-4">
          {precios.data.planes.map((p) => (
            <TarjetaPlan
              key={p.plan}
              id={p.plan}
              precio={p.ciclos.find((c) => c.ciclo === ciclo)!}
              codigo={cupon?.codigo ?? null}
              etiqueta={precios.data!.beneficios?.etiquetas[ciclo] ?? null}
              esActual={actual === p.plan}
            />
          ))}
        </div>
      )}

      <p className="mx-auto max-w-2xl text-center text-xs text-muted-foreground">
        Precios sin IVA (21%), recuperable para responsables inscriptos. Los descuentos de los códigos se calculan sobre el precio de lista y no se acumulan entre sí; el de recomendar a otros negocios se suma aparte.
      </p>
    </div>
  );
}

/** Premios por recomendar: el descuento ya está aplicado en los precios del próximo pago. */
function AvisoReferidos({ pct }: { pct: number }) {
  return (
    <Card size="sm" className={cn(pct > 0 && "ring-2 ring-primary/40")}>
      <CardHeader className="flex flex-row flex-wrap items-center gap-3">
        <Gift className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{pct > 0 ? `Tenés ${pct}% de descuento en tu próximo pago` : "Recomendá y pagá menos"}</CardTitle>
          <CardDescription>
            {pct > 0
              ? "Por los negocios que recomendaste. Ya está descontado en los precios de abajo."
              : "Por cada negocio que se registre con tu código y pague, ganás 10% en tu próximo pago."}
          </CardDescription>
        </div>
        <Link href="/recomendar" className="text-sm font-medium text-primary underline">
          {pct > 0 ? "Ver mis recomendados" : "Ver mi código"}
        </Link>
      </CardHeader>
    </Card>
  );
}
