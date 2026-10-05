"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Check, Copy, Gift, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useApiFetch } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

// Espejo de GET /referidos (apps/api modules/alianzas/referidos.service.ts).
interface Referidos {
  codigo: string;
  link: string;
  reglas: { diasPrueba: number; descuentoNuevoPct: number; premioPct: number; maxPorAnio: number };
  premios: { disponibles: number; pctProximoPago: number; usados: number; delAnio: number; fueraDeTope: number };
  recomendados: { nombre: string; desde: string; estado: "en_prueba" | "pago" | "devuelto"; premio: string | null }[];
}

const ESTADO: Record<Referidos["recomendados"][number]["estado"], [string, string]> = {
  en_prueba: ["En su prueba gratis", "bg-muted text-muted-foreground"],
  pago: ["Ya pagó", "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"],
  devuelto: ["Pago devuelto", "bg-amber-500/15 text-amber-700 dark:text-amber-300"],
};
const PREMIO: Record<string, string> = { disponible: "Ganaste 10%", usado: "10% ya usado", tope: "Fuera del tope del año", anulado: "Sin premio" };
const fecha = (iso: string) => iso.split("-").reverse().join("/");

/** "Recomendá y ganá": el código del negocio para compartir, lo que gana cada uno y a quiénes recomendó. */
export function RecomendarVista() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ["referidos", orgId], queryFn: () => api<Referidos>("/referidos"), enabled: Boolean(orgId) });
  const [copiado, setCopiado] = useState<"codigo" | "link" | null>(null);

  if (isPending) return <CargandoFilas filas={5} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  const { reglas: r, premios: p } = data;

  const copiar = async (que: "codigo" | "link") => {
    try {
      await navigator.clipboard.writeText(que === "codigo" ? data.codigo : data.link);
      setCopiado(que);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      toast.error("No se pudo copiar: seleccionalo y copialo a mano.");
    }
  };
  const mensaje = `Hola! Yo uso Analítica 360 para manejar las ventas, el stock y los números de mi negocio. Si te registrás con mi código ${data.codigo} tenés ${r.diasPrueba} días gratis y ${r.descuentoNuevoPct}% de descuento en tu primer pago: ${data.link}`;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="size-5 text-primary" aria-hidden /> Tu código
          </CardTitle>
          <CardDescription>Compartilo con otros negocios. Cuando alguien se registra con él y paga su primer mes, vos ganás {r.premioPct}% de descuento.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-2 font-mono text-2xl font-semibold tracking-wider">{data.codigo}</span>
            <Button variant="outline" onClick={() => void copiar("codigo")}>
              {copiado === "codigo" ? <Check aria-hidden /> : <Copy aria-hidden />} {copiado === "codigo" ? "Copiado" : "Copiar código"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noreferrer" className={cn(buttonVariants(), "bg-[#25d366] text-white hover:bg-[#1ebe5a]")}>
              <MessageCircle aria-hidden /> Compartir por WhatsApp
            </a>
            <Button variant="outline" onClick={() => void copiar("link")}>
              {copiado === "link" ? <Check aria-hidden /> : <Copy aria-hidden />} {copiado === "link" ? "Link copiado" : "Copiar link de registro"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Paso n={1} titulo="Compartís tu código" texto="Por WhatsApp, en persona o con el link: ya lleva tu código puesto." />
        <Paso n={2} titulo={`Tu amigo gana ${r.diasPrueba} días gratis`} texto={`Y ${r.descuentoNuevoPct}% de descuento en su primer pago (en vez de 14 días de prueba).`} />
        <Paso n={3} titulo={`Vos ganás ${r.premioPct}%`} texto={`Cuando paga su primer mes. Se suman en tu próximo pago: 3 amigos = ${3 * r.premioPct}%. Hasta ${r.maxPorAnio} por año.`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Dato titulo="Descuento para tu próximo pago" valor={`${p.pctProximoPago}%`} destacado={p.pctProximoPago > 0} detalle={p.disponibles ? `${p.disponibles} ${p.disponibles === 1 ? "premio" : "premios"} sin usar` : "Todavía ninguno"} />
        <Dato titulo="Premios de este año" valor={`${p.delAnio} de ${r.maxPorAnio}`} detalle={p.fueraDeTope ? `${p.fueraDeTope} quedaron fuera del tope` : "Contando los últimos 12 meses"} />
        <Dato titulo="Ya usados" valor={String(p.usados)} detalle="Descontados en tus pagos" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Negocios que recomendaste</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recomendados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía nadie se registró con tu código. ¡Compartilo!</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {data.recomendados.map((x, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="font-medium">{x.nombre}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">desde el {fecha(x.desde)}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", ESTADO[x.estado][1])}>{ESTADO[x.estado][0]}</span>
                    {x.premio && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{PREMIO[x.premio] ?? x.premio}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        El descuento se aplica sobre el precio de tu próximo período (después del descuento de tu código, si tenés). Si un pago se devuelve antes de usar el premio, el premio se anula. Tu propio negocio no puede usar tu código.
      </p>
    </div>
  );
}

function Paso({ n, titulo, texto }: { n: number; titulo: string; texto: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{n}</span>
        <CardTitle className="mt-2 text-base">{titulo}</CardTitle>
        <CardDescription>{texto}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function Dato({ titulo, valor, detalle, destacado }: { titulo: string; valor: string; detalle: string; destacado?: boolean }) {
  return (
    <Card size="sm" className={cn(destacado && "ring-2 ring-primary/40")}>
      <CardHeader>
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{valor}</CardTitle>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </CardHeader>
    </Card>
  );
}
