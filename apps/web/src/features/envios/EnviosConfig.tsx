"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputPlata } from "@/components/shared/input-plata";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useRol } from "@/hooks/use-rol";
import { useAccionesEnvios, useEnvios, type EstadoEnvios } from "./use-envios";

/** Configuración → Envíos: conectar la cuenta de Zipnova (Correo Argentino, Andreani, OCA y más con una sola cuenta). */
export function EnviosConfig() {
  const { data, isPending, isError, error, refetch } = useEnvios();
  if (isPending) return <CargandoFilas filas={4} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  return <Formulario key={data.config?.verificadoEn ?? "nuevo"} estado={data} />;
}

const numero = (v: string) => {
  const n = Number(v.replace(/\D/g, ""));
  return n > 0 ? n : null;
};

function Formulario({ estado }: { estado: EstadoEnvios }) {
  const esDueno = useRol() === "dueno";
  const { guardar, desconectar } = useAccionesEnvios();
  const c = estado.config;
  const [cuentaId, setCuentaId] = useState(c ? String(c.cuentaId) : "");
  const [origenId, setOrigenId] = useState(c?.origenId ? String(c.origenId) : "");
  const [token, setToken] = useState("");
  const [secreto, setSecreto] = useState("");
  const [enTienda, setEnTienda] = useState(c?.enTienda ?? true);
  const [gratis, setGratis] = useState(c?.gratisDesde != null);
  const [gratisDesde, setGratisDesde] = useState(c?.gratisDesde != null ? String(c.gratisDesde) : "");
  const [peso, setPeso] = useState(String(c?.pesoDefectoGr ?? 1000));

  if (!estado.disponible) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Los envíos con Correo Argentino, Andreani y otros están en preparación: muy pronto vas a poder cotizarlos en tu tienda y despachar desde cada pedido.</p>;
  }

  const conectar = () => {
    const cuenta = numero(cuentaId);
    if (!cuenta) return toast.error("Ingresá el número de cuenta de Zipnova");
    guardar.mutate(
      { cuentaId: cuenta, origenId: numero(origenId), token: token.trim() || null, secreto: secreto.trim() || null, enTienda, gratisDesde: gratis && gratisDesde ? Number(gratisDesde) : null, pesoDefectoGr: numero(peso) ?? 1000 },
      {
        onSuccess: () => {
          setToken("");
          setSecreto("");
          toast.success(c ? "Cambios guardados" : "¡Listo! Tu cuenta de Zipnova quedó conectada");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo conectar", { duration: 12_000 }),
      },
    );
  };
  const copiar = (texto: string) => void navigator.clipboard.writeText(texto).then(() => toast.success("Copiado"));

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Truck className="size-4 text-primary" /> Cómo funciona
        </p>
        <p className="mt-1 text-muted-foreground">
          Con una cuenta de <strong>Zipnova</strong> tenés Correo Argentino, Andreani, OCA y otros sin mínimos de envíos. Tu tienda cotiza el envío con el código postal del cliente, y desde cada pedido creás el envío e imprimís la etiqueta. Los envíos se pagan en tu cuenta de Zipnova.
        </p>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
          <li>Creá tu cuenta en zipnova.com.ar y cargá tu dirección de despacho.</li>
          <li>En Zipnova → Configuración → API, generá un <strong>token</strong> y un <strong>secreto</strong>, y anotá tu <strong>número de cuenta</strong>.</li>
          <li>Pegalos acá abajo y tocá «Conectar».</li>
        </ol>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="env-cuenta">Número de cuenta</Label>
          <Input id="env-cuenta" inputMode="numeric" value={cuentaId} disabled={!esDueno} onChange={(e) => setCuentaId(e.target.value)} placeholder="12345" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="env-origen">Dirección de despacho (opcional)</Label>
          <Input id="env-origen" inputMode="numeric" value={origenId} disabled={!esDueno} onChange={(e) => setOrigenId(e.target.value)} placeholder="Vacío = la principal de tu cuenta" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="env-token">Token de la API</Label>
          <Input id="env-token" autoComplete="off" value={token} disabled={!esDueno} onChange={(e) => setToken(e.target.value)} placeholder={c ? "Guardado (dejalo vacío para no cambiarlo)" : ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="env-secreto">Secreto de la API</Label>
          <Input id="env-secreto" type="password" autoComplete="new-password" value={secreto} disabled={!esDueno} onChange={(e) => setSecreto(e.target.value)} placeholder={c ? "Guardado (dejalo vacío para no cambiarlo)" : ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="env-peso">Peso por defecto (gramos)</Label>
          <Input id="env-peso" inputMode="numeric" value={peso} disabled={!esDueno} onChange={(e) => setPeso(e.target.value)} />
          <span className="text-xs text-muted-foreground">Para los productos sin peso cargado. Conviene cargar peso y medidas en cada producto: el envío sale más justo.</span>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={enTienda} disabled={!esDueno} onChange={(e) => setEnTienda(e.target.checked)} /> Cotizar el envío en mi tienda online
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={gratis} disabled={!esDueno} onChange={(e) => setGratis(e.target.checked)} /> Envío gratis desde un monto
          </label>
          {gratis && <InputPlata aria-label="Envío gratis desde" value={gratisDesde} onChange={(e) => setGratisDesde(e.target.value)} disabled={!esDueno} />}
        </div>
      </div>

      {c?.urlAvisos && (
        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <p className="font-medium">Para que los pedidos se marquen solos como entregados</p>
          <p className="text-muted-foreground">En Zipnova → Configuración → Webhooks, agregá esta dirección con el tópico «status»:</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-xs">{c.urlAvisos}</code>
            <Button size="sm" variant="outline" onClick={() => copiar(c.urlAvisos!)}>
              <Copy className="size-4" /> Copiar
            </Button>
          </div>
        </div>
      )}

      {esDueno ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={conectar} disabled={guardar.isPending}>
            {guardar.isPending ? "Conectando con Zipnova…" : c ? "Guardar cambios" : "Conectar"}
          </Button>
          {c?.verificadoEn && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" /> Conectado
            </span>
          )}
          {c && (
            <Button
              variant="ghost"
              className="ml-auto text-destructive"
              disabled={desconectar.isPending}
              onClick={() => {
                if (window.confirm("¿Desconectar Zipnova? La tienda deja de cotizar envíos (vuelve a «a coordinar»)."))
                  desconectar.mutate(undefined, { onSuccess: () => toast.success("Zipnova desconectado") });
              }}
            >
              Desconectar
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Solo el dueño puede conectar los envíos.</p>
      )}
    </div>
  );
}
