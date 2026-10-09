"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useApiFetch } from "@/hooks/use-api";
import { useRol } from "@/hooks/use-rol";
import { formatoFechaHora } from "@/lib/formato";

interface EstadoMp {
  disponible: boolean;
  cuenta: { mpUserId: string; conectadoEn: string; venceEn: string } | null;
}

const MENSAJES: Record<string, [ok: boolean, texto: string]> = {
  ok: [true, "¡Listo! Tu cuenta de Mercado Pago quedó conectada: la tienda ya ofrece pagar con Mercado Pago"],
  cancelado: [false, "No se conectó: cancelaste la autorización en Mercado Pago"],
  vencido: [false, "Pasó mucho tiempo: tocá «Conectar Mercado Pago» de nuevo"],
  error: [false, "Mercado Pago no confirmó la conexión. Probá de nuevo en unos minutos"],
};

/** Configuración → Cobros con Mercado Pago: la tienda cobra en la cuenta del comercio. */
export function MercadoPagoTiendaConfig() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const esDueno = useRol() === "dueno";
  const router = useRouter();
  const resultado = useSearchParams().get("mp");
  const avisado = useRef(false);

  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ["mp-tienda", orgId], queryFn: () => api<EstadoMp>("/mercadopago/tienda"), enabled: Boolean(orgId) });
  const conectar = useMutation({ mutationFn: () => api<{ url: string }>("/mercadopago/tienda/conectar", { method: "POST" }) });
  const desconectar = useMutation({
    mutationFn: () => api<void>("/mercadopago/tienda", { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["mp-tienda"] }),
  });

  // Vuelta de Mercado Pago (?mp=ok|cancelado|vencido|error): se avisa una vez y se limpia la dirección.
  useEffect(() => {
    if (!resultado || avisado.current) return;
    avisado.current = true;
    const [ok, texto] = MENSAJES[resultado] ?? MENSAJES.error;
    if (ok) toast.success(texto, { duration: 10_000 });
    else toast.error(texto, { duration: 10_000 });
    router.replace("/configuracion?s=mercadopago");
  }, [resultado, router]);

  if (isPending) return <CargandoFilas filas={3} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  if (!data.disponible) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Muy pronto tus clientes van a poder pagar los pedidos de la tienda con Mercado Pago (tarjeta, débito o dinero en cuenta), directo a tu cuenta.</p>;
  }

  const irAMercadoPago = () =>
    conectar.mutate(undefined, {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo iniciar la conexión"),
    });

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="rounded-xl border p-4">
        <p className="flex items-center gap-2 font-medium">
          <Wallet className="size-4 text-primary" /> Cómo funciona
        </p>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
          <li>En el checkout de tu tienda aparece «Mercado Pago»: el cliente paga con tarjeta, débito o dinero en cuenta.</li>
          <li>
            La plata va <strong>directo a tu cuenta de Mercado Pago</strong>, con las comisiones de Mercado Pago. Analítica 360 no cobra nada extra.
          </li>
          <li>Cuando se aprueba el pago, el pedido se marca solo como <strong>pagado</strong>.</li>
        </ul>
      </div>

      {data.cuenta ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" /> Conectada (cuenta {data.cuenta.mpUserId}, desde el {formatoFechaHora(data.cuenta.conectadoEn)})
          </span>
          {esDueno && (
            <Button
              variant="ghost"
              className="ml-auto text-destructive"
              disabled={desconectar.isPending}
              onClick={() => {
                if (window.confirm("¿Desconectar Mercado Pago? La tienda deja de ofrecerlo en el checkout (los pagos ya hechos no se tocan)."))
                  desconectar.mutate(undefined, { onSuccess: () => toast.success("Mercado Pago desconectado") });
              }}
            >
              Desconectar
            </Button>
          )}
        </div>
      ) : esDueno ? (
        <div className="flex flex-col items-start gap-2">
          <Button onClick={irAMercadoPago} disabled={conectar.isPending}>
            {conectar.isPending ? "Abriendo Mercado Pago…" : "Conectar Mercado Pago"}
          </Button>
          <span className="text-xs text-muted-foreground">Te lleva a Mercado Pago para que autorices a Analítica 360 a crear cobros en tu cuenta. No vemos tu clave.</span>
        </div>
      ) : (
        <p className="text-muted-foreground">Solo el dueño puede conectar la cuenta de Mercado Pago.</p>
      )}
    </div>
  );
}
