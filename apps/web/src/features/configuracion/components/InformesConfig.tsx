"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Download, Loader2, Mail, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { CandadoPlan } from "@/components/shared/mejorar-plan";
import { useApiFetch } from "@/hooks/use-api";
import { usePlan } from "@/hooks/use-plan";
import { apiArchivo } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Tipo = "semanal" | "mensual";

// Espejo de GET /informes/config y /informes/historial (apps/api modules/informes/informes.service.ts).
interface ConfigInformes {
  semanal: boolean;
  mensual: boolean;
  conDolares: boolean;
  emailsExtra: string[];
  duenos: string[];
  bajas: { tipo: Tipo; email: string }[];
}
interface Envio {
  id: string;
  tipo: Tipo;
  desde: string;
  hasta: string;
  estado: "enviando" | "enviado" | "sin_destinatarios" | "sin_servicio" | "error";
  destinatarios: string[];
  error: string | null;
  enviadoEn: string | null;
}

const TIPOS: { tipo: Tipo; titulo: string; cuando: string; trae: string }[] = [
  { tipo: "semanal", titulo: "Informe semanal", cuando: "Los lunes a las 8, con la semana anterior", trae: "Ventas, ganancia, ventas por día, lo más vendido, formas de pago, compras y stock bajo." },
  { tipo: "mensual", titulo: "Informe mensual", cuando: "El día 1 a las 8, con el mes anterior", trae: "Todo lo del semanal, más quién te debe (cuenta corriente) y cómo venís con el monotributo." },
];
const ESTADO: Record<Envio["estado"], [string, string]> = {
  enviado: ["Enviado", "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"],
  enviando: ["Enviando", "bg-sky-500/15 text-sky-700 dark:text-sky-300"],
  sin_servicio: ["Sin envío de emails", "bg-amber-500/15 text-amber-700 dark:text-amber-300"],
  sin_destinatarios: ["Sin destinatarios", "bg-muted text-muted-foreground"],
  error: ["Error", "bg-red-500/15 text-red-700 dark:text-red-300"],
};
const fecha = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Configuración → Informes por email: el resumen semanal y mensual en PDF. */
export function InformesConfig() {
  const api = useApiFetch();
  const { orgId, getToken } = useAuth();
  const plan = usePlan();
  const queryClient = useQueryClient();
  const clave = ["informes-config", orgId];
  const config = useQuery({ queryKey: clave, queryFn: () => api<ConfigInformes>("/informes/config"), enabled: Boolean(orgId) });
  const historial = useQuery({ queryKey: ["informes-historial", orgId], queryFn: () => api<Envio[]>("/informes/historial"), enabled: Boolean(orgId) });
  const [nuevo, setNuevo] = useState("");
  const [bajando, setBajando] = useState<Tipo | null>(null);

  const guardar = useMutation({
    mutationFn: (cambios: Partial<Pick<ConfigInformes, "semanal" | "mensual" | "conDolares" | "emailsExtra">> & { reactivar?: string }) =>
      api<ConfigInformes>("/informes/config", { method: "PATCH", body: JSON.stringify(cambios) }),
    onSuccess: (c) => {
      queryClient.setQueryData(clave, c);
      setNuevo("");
      toast.success("Guardado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });
  const prueba = useMutation({
    mutationFn: (tipo: Tipo) => api<{ para: string }>(`/informes/prueba/${tipo}`, { method: "POST" }),
    onSuccess: (r) => toast.success(`Te lo mandamos a ${r.para}`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo mandar"),
  });

  async function descargar(tipo: Tipo) {
    setBajando(tipo);
    try {
      const pdf = await apiArchivo(`/informes/pdf/${tipo}`, await getToken());
      const url = URL.createObjectURL(pdf);
      const a = document.createElement("a");
      a.href = url;
      a.download = `informe-${tipo}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar");
    } finally {
      setBajando(null);
    }
  }

  if (config.isPending) return <CargandoFilas filas={4} />;
  if (config.isError) return <ErrorDatos error={config.error} onReintentar={() => config.refetch()} />;
  const c = config.data;
  const agregar = () => {
    const email = nuevo.trim().toLowerCase();
    if (!email) return;
    guardar.mutate({ emailsExtra: [...c.emailsExtra, email] });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Te mandamos por email un resumen de cómo viene el negocio, con un PDF adjunto. Llega a los dueños de la cuenta y a los emails que sumes acá (por ejemplo, tu contador).
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {TIPOS.map((t) => {
          const incluido = t.tipo === "semanal" || plan.incluye("informe_mensual");
          const activo = c[t.tipo];
          return (
            <div key={t.tipo} className={cn("flex flex-col gap-3 rounded-xl border p-4", !incluido && "opacity-80")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    {t.titulo} {!incluido && <CandadoPlan funcion="informe_mensual" />}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.cuando}</p>
                </div>
                {incluido && (
                  <label className="flex shrink-0 items-center gap-2 text-sm">
                    <input type="checkbox" checked={activo} disabled={guardar.isPending} onChange={(e) => guardar.mutate({ [t.tipo]: e.target.checked })} />
                    {activo ? "Activado" : "Apagado"}
                  </label>
                )}
              </div>
              <p className="text-sm">{t.trae}</p>
              {incluido ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={bajando !== null} onClick={() => void descargar(t.tipo)}>
                    {bajando === t.tipo ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} Ver el último
                  </Button>
                  <Button variant="outline" size="sm" disabled={prueba.isPending} onClick={() => prueba.mutate(t.tipo)}>
                    {prueba.isPending && prueba.variables === t.tipo ? <Loader2 className="animate-spin" aria-hidden /> : <Mail aria-hidden />} Enviarme uno de prueba
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Está en el plan Pro. El semanal te sigue llegando.</p>
              )}
            </div>
          );
        })}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={c.conDolares} disabled={guardar.isPending} onChange={(e) => guardar.mutate({ conDolares: e.target.checked })} />
        <span>
          Mostrar también los números en dólares
          <span className="block text-muted-foreground">Con el dólar del día de cada venta (el que elegiste en Configuración fiscal).</span>
        </span>
      </label>

      <div className="flex flex-col gap-3">
        <p className="font-medium">Quién lo recibe</p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {c.duenos.map((e) => (
            <li key={e} className="flex items-center gap-2">
              <span>{e}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">dueño</span>
            </li>
          ))}
          {c.emailsExtra.map((e) => (
            <li key={e} className="flex items-center gap-2">
              <span>{e}</span>
              <Button variant="ghost" size="icon" className="size-7" aria-label={`Quitar ${e}`} disabled={guardar.isPending} onClick={() => guardar.mutate({ emailsExtra: c.emailsExtra.filter((x) => x !== e) })}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        {c.emailsExtra.length < 5 && (
          <form
            className="flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              agregar();
            }}
          >
            <Input type="email" placeholder="contador@estudio.com" value={nuevo} onChange={(e) => setNuevo(e.target.value)} aria-label="Sumar un email" maxLength={160} />
            <Button type="submit" variant="outline" disabled={!nuevo.trim() || guardar.isPending}>
              <Plus aria-hidden /> Sumar
            </Button>
          </form>
        )}
        {c.bajas.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground">Se dieron de baja desde el email:</p>
            {c.bajas.map((b) => (
              <div key={`${b.tipo}:${b.email}`} className="flex flex-wrap items-center gap-2">
                <span>
                  {b.email} · informe {b.tipo}
                </span>
                <Button variant="link" size="sm" className="h-auto p-0" disabled={guardar.isPending} onClick={() => guardar.mutate({ reactivar: b.email })}>
                  Volver a mandarle
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-medium">Últimos envíos</p>
        {historial.isPending ? (
          <CargandoFilas filas={2} />
        ) : !historial.data?.length ? (
          <p className="text-sm text-muted-foreground">Todavía no salió ninguno. El primero llega el próximo lunes a las 8.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border text-sm">
            {historial.data.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="font-medium capitalize">{h.tipo}</span>
                <span className="text-muted-foreground">
                  {fecha(h.desde)} al {fecha(h.hasta)}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs", ESTADO[h.estado][1])}>{ESTADO[h.estado][0]}</span>
                {h.destinatarios.length > 0 && <span className="text-muted-foreground">a {h.destinatarios.join(", ")}</span>}
                {h.error && <span className="w-full text-xs text-red-700 dark:text-red-300">{h.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
