"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useApiFetch } from "@/hooks/use-api";

// Espejo de GET /cuenta/baja (apps/api modules/bajas).
interface EstadoBaja {
  programadaPara: string | null;
  solicitadaEn: string | null;
  solicitadaPor: string | null;
  diasRestantes: number | null;
}

const fecha = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Configuración → Borrar mi cuenta: se pide, quedan 30 días para arrepentirse y después se borra todo. */
export function BorrarCuentaConfig() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const estado = useQuery({ queryKey: ["baja", orgId], queryFn: () => api<EstadoBaja>("/cuenta/baja"), enabled: Boolean(orgId) });
  const [confirmacion, setConfirmacion] = useState("");
  const listo = (e: EstadoBaja) => {
    queryClient.setQueryData(["baja", orgId], e);
    // El aviso de arriba y el bloqueo de carga dependen de esto.
    void queryClient.invalidateQueries({ queryKey: ["suscripcion"] });
  };
  const pedir = useMutation({
    mutationFn: () => api<EstadoBaja>("/cuenta/baja", { method: "POST", body: JSON.stringify({ confirmacion }) }),
    onSuccess: (e) => {
      listo(e);
      setConfirmacion("");
      toast.success("Listo: la cuenta se borra en 30 días. Podés cancelarlo hasta entonces.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo pedir la baja"),
  });
  const cancelar = useMutation({
    mutationFn: () => api<EstadoBaja>("/cuenta/baja", { method: "DELETE" }),
    onSuccess: (e) => {
      listo(e);
      toast.success("Cancelaste la baja: tu cuenta sigue como siempre.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cancelar"),
  });

  if (estado.isPending) return <CargandoFilas filas={3} />;
  if (estado.isError) return <ErrorDatos error={estado.error} onReintentar={() => estado.refetch()} />;
  const e = estado.data;

  if (e.programadaPara) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <div className="flex gap-3 rounded-xl bg-destructive/10 p-4 text-sm ring-1 ring-destructive/30">
          <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
          <p>
            La cuenta se borra el <b>{fecha(e.programadaPara)}</b> (faltan {e.diasRestantes} {e.diasRestantes === 1 ? "día" : "días"}). La pidió {e.solicitadaPor ?? "el dueño"}
            {e.solicitadaEn ? ` el ${fecha(e.solicitadaEn)}` : ""}. Hasta entonces podés ver y descargar tus datos, pero no cargar nada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={cancelar.isPending} onClick={() => cancelar.mutate()}>
            {cancelar.isPending && <Loader2 className="animate-spin" aria-hidden />} Cancelar la baja
          </Button>
          <Link href="/configuracion?s=exportar" className="inline-flex items-center rounded-lg px-3 text-sm font-medium ring-1 ring-border hover:bg-muted">
            Descargar mis datos
          </Link>
        </div>
      </div>
    );
  }

  const nombre = organization?.name ?? "";
  return (
    <div className="flex max-w-xl flex-col gap-4 text-sm">
      <p>
        Si borrás la cuenta, en <b>30 días</b> se borran para siempre todos los datos del negocio: productos, ventas, clientes, compras, pedidos, fotos, la tienda online y los usuarios del equipo. Durante esos 30 días la cuenta queda en solo lectura y
        podés arrepentirte.
      </p>
      <p className="text-muted-foreground">
        Quedan solo los pagos que le hiciste a Analítica 360 (para la facturación) y el registro de auditoría con tus datos personales tapados. Antes de seguir, te conviene{" "}
        <Link href="/configuracion?s=exportar" className="font-medium text-foreground underline">
          descargar tus datos
        </Link>
        .
      </p>
      <form
        className="flex flex-col gap-2 rounded-xl p-4 ring-1 ring-destructive/30"
        onSubmit={(ev) => {
          ev.preventDefault();
          pedir.mutate();
        }}
      >
        <Label htmlFor="borrar-confirmar">
          Para confirmar, escribí el nombre del negocio
          {nombre ? (
            <>
              : <b>{nombre}</b>
            </>
          ) : null}
        </Label>
        <Input id="borrar-confirmar" value={confirmacion} onChange={(ev) => setConfirmacion(ev.target.value)} autoComplete="off" />
        <Button type="submit" variant="destructive" className="w-fit" disabled={!confirmacion.trim() || pedir.isPending}>
          {pedir.isPending && <Loader2 className="animate-spin" aria-hidden />} Borrar mi cuenta en 30 días
        </Button>
      </form>
    </div>
  );
}
