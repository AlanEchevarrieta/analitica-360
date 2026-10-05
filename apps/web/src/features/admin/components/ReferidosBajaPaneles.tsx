"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorDatos } from "@/components/shared/estado-datos";
import { useApiFetch } from "@/hooks/use-api";
import { Panel } from "./comunes";

const fecha = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

// Espejo de GET /admin/empresas/:id/referidos (apps/api modules/alianzas/referidos.service.ts).
interface ReferidosAdmin {
  codigo: string | null;
  recomendadoPor: { empresaId: string; nombre: string; codigo: string; premio: string | null } | null;
  premios: { disponibles: number; pctProximoPago: number; usados: number; delAnio: number; fueraDeTope: number } | null;
  recomendados: { nombre: string; desde: string; estado: string; premio: string | null }[];
}

const PREMIO: Record<string, string> = { disponible: "premio sin usar", usado: "premio usado", tope: "fuera del tope", anulado: "premio anulado" };

/** Ficha del cliente: su código, a quiénes recomendó, sus premios y quién lo recomendó a él. */
export function ReferidosClientePanel({ empresaId }: { empresaId: string }) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const q = useQuery({ queryKey: ["admin", "referidos", empresaId, orgId], queryFn: () => api<ReferidosAdmin>(`/admin/empresas/${empresaId}/referidos`), enabled: Boolean(orgId) });
  if (q.isPending) return null;
  if (q.isError) return <ErrorDatos error={q.error} onReintentar={() => q.refetch()} />;
  const r = q.data;
  if (!r.codigo && !r.recomendadoPor) return null;
  return (
    <Panel titulo="Recomendá y ganá" descripcion="Referidos: lo que recomendó y lo que ganó">
      <div className="flex flex-col gap-3 text-sm">
        {r.recomendadoPor && (
          <p>
            Vino recomendado por{" "}
            <Link prefetch={false} href={`/admin/clientes/${r.recomendadoPor.empresaId}`} className="font-medium underline">
              {r.recomendadoPor.nombre}
            </Link>{" "}
            (código <span className="font-mono">{r.recomendadoPor.codigo}</span>){r.recomendadoPor.premio ? ` · ${PREMIO[r.recomendadoPor.premio] ?? r.recomendadoPor.premio} para quien lo recomendó` : " · todavía no pagó"}.
          </p>
        )}
        {r.codigo && r.premios && (
          <>
            <p>
              Su código: <span className="font-mono font-medium">{r.codigo}</span> · descuento para su próximo pago: <strong>{r.premios.pctProximoPago}%</strong> · premios del año: {r.premios.delAnio} de 6 · usados: {r.premios.usados}
              {r.premios.fueraDeTope ? ` · ${r.premios.fueraDeTope} fuera del tope` : ""}
            </p>
            {r.recomendados.length > 0 ? (
              <ul className="flex flex-col divide-y">
                {r.recomendados.map((x, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5">
                    <span>{x.nombre}</span>
                    <span className="text-xs text-muted-foreground">
                      desde {fecha(x.desde)} · {x.estado === "pago" ? "pagó" : x.estado === "devuelto" ? "pago devuelto" : "en prueba"}
                      {x.premio ? ` · ${PREMIO[x.premio] ?? x.premio}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Todavía no recomendó a nadie.</p>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

// Espejo de GET /admin/bajas/:empresaId (apps/api modules/bajas).
interface EstadoBaja {
  programadaPara: string | null;
  solicitadaEn: string | null;
  solicitadaPor: string | null;
  diasRestantes: number | null;
}

/** Ficha del cliente: baja de la cuenta a pedido (ver, pedir con 30 días, cancelar o ejecutar ya). */
export function BajaClientePanel({ empresaId, nombre, esDemo }: { empresaId: string; nombre: string; esDemo: boolean }) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const clave = ["admin", "baja", empresaId, orgId];
  const q = useQuery({ queryKey: clave, queryFn: () => api<EstadoBaja>(`/admin/bajas/${empresaId}`), enabled: Boolean(orgId) && !esDemo });
  const [confirmacion, setConfirmacion] = useState("");
  const [ejecutar, setEjecutar] = useState(false);
  const refrescar = () => void queryClient.invalidateQueries({ queryKey: ["admin"] });
  const error = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo");
  const pedir = useMutation({
    mutationFn: () => api<EstadoBaja>(`/admin/bajas/${empresaId}`, { method: "POST", body: JSON.stringify({ confirmacion }) }),
    onSuccess: () => {
      setConfirmacion("");
      toast.success("Baja programada para dentro de 30 días.");
      refrescar();
    },
    onError: error,
  });
  const cancelar = useMutation({ mutationFn: () => api(`/admin/bajas/${empresaId}`, { method: "DELETE" }), onSuccess: () => (toast.success("Baja cancelada."), refrescar()), onError: error });
  const ya = useMutation({
    mutationFn: () => api<{ filasBorradas: number }>(`/admin/bajas/${empresaId}/ejecutar`, { method: "POST" }),
    onSuccess: (r) => (toast.success(`Cuenta borrada (${r.filasBorradas} registros).`), refrescar()),
    onError: error,
  });

  if (esDemo || q.isPending) return null;
  if (q.isError) return <ErrorDatos error={q.error} onReintentar={() => q.refetch()} />;
  const e = q.data;
  return (
    <Panel titulo="Baja de la cuenta" descripcion="Borrado de todos los datos a pedido del titular (Ley 25.326)">
      {e.programadaPara ? (
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Se borra el <strong>{fecha(e.programadaPara)}</strong> (faltan {e.diasRestantes} días). La pidió {e.solicitadaPor ?? "—"}
            {e.solicitadaEn ? ` el ${fecha(e.solicitadaEn)}` : ""}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={cancelar.isPending} onClick={() => cancelar.mutate()}>
              Cancelar la baja
            </Button>
            {!ejecutar ? (
              <Button variant="destructive" size="sm" onClick={() => setEjecutar(true)}>
                Borrar ya
              </Button>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-destructive">¿Seguro? No se puede deshacer.</span>
                <Button variant="destructive" size="sm" disabled={ya.isPending} onClick={() => ya.mutate()}>
                  Sí, borrar ahora
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEjecutar(false)}>
                  No
                </Button>
              </span>
            )}
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2 text-sm"
          onSubmit={(ev) => {
            ev.preventDefault();
            pedir.mutate();
          }}
        >
          <p className="text-muted-foreground">Si el cliente lo pide por escrito: escribí el nombre del negocio ({nombre}) para programar la baja en 30 días.</p>
          <div className="flex flex-wrap gap-2">
            <Input value={confirmacion} onChange={(ev) => setConfirmacion(ev.target.value)} placeholder={nombre} className="max-w-xs" aria-label="Nombre del negocio para confirmar" />
            <Button type="submit" variant="destructive" size="sm" disabled={!confirmacion.trim() || pedir.isPending}>
              Programar la baja
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}
