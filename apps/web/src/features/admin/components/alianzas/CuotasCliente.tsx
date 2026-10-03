"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoPesos } from "@/lib/formato";
import { NOMBRE_PLAN } from "../../hooks/use-admin";
import { fechaAR, NOMBRE_CICLO, useAccionesAlianzas, useCuotasEmpresa, useCuotasVencidas, type CuotaFila, type PlanPago } from "../../hooks/use-alianzas";
import { Panel } from "../comunes";

const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";
const ESTADO: Record<CuotaFila["estado"], { texto: string; clase: string }> = {
  pagada: { texto: "Pagada", clase: "text-emerald-500" },
  pendiente: { texto: "Pendiente", clase: "text-muted-foreground" },
  vencida: { texto: "Vencida", clase: "text-red-400 font-medium" },
};

/** Botón para cobrar la próxima cuota de un período (con el medio de pago). */
function CobrarCuota({ empresaId, cuota }: { empresaId: string; cuota: CuotaFila }) {
  const { registrarPago } = useAccionesAlianzas();
  const [metodo, setMetodo] = useState("transferencia");
  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      <select className={selectClase} aria-label="Medio de pago" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
        <option value="transferencia">Transferencia</option>
        <option value="mercadopago">Mercado Pago</option>
        <option value="efectivo">Efectivo</option>
        <option value="otro">Otro</option>
      </select>
      <Button
        size="sm"
        disabled={registrarPago.isPending}
        onClick={() =>
          registrarPago.mutate(
            { empresaId, plan: cuota.plan as PlanPago, ciclo: cuota.ciclo, grupoId: cuota.grupoId, metodo, notas: "" },
            { onSuccess: () => toast.success(`Cuota ${cuota.numero} de ${cuota.cuotas} cobrada`), onError: (e) => toast.error(e.message) },
          )
        }
      >
        Cobrar cuota {cuota.numero}
      </Button>
    </span>
  );
}

/** Ficha del cliente: sus planes de cuotas (pagadas, pendientes y vencidas). */
export function CuotasClientePanel({ empresaId }: { empresaId: string }) {
  const planes = useCuotasEmpresa(empresaId);
  if (planes.isPending || (planes.data?.length ?? 0) === 0) return null;
  return (
    <Panel titulo="Cuotas" descripcion="Períodos que paga en cuotas sin interés">
      {planes.isError ? (
        <ErrorDatos error={planes.error} onReintentar={() => planes.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          {planes.data!.map((g) => {
            const proxima = g.cuotas.find((c) => c.estado !== "pagada");
            return (
              <div key={g.grupoId} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <strong>{NOMBRE_PLAN(g.plan)} {NOMBRE_CICLO[g.ciclo]?.toLowerCase()}</strong> · {g.pagadas} de {g.cuotas.length} cuotas pagas · total {formatoPesos(g.total)}
                  </span>
                  {proxima && <CobrarCuota empresaId={empresaId} cuota={proxima} />}
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.cuotas.map((c) => (
                    <span key={c.id} className="rounded-lg border px-2.5 py-1.5 text-xs tabular-nums">
                      <span className="font-medium">Cuota {c.numero}</span> · {formatoPesos(c.monto)} · vence {fechaAR(c.vence)} ·{" "}
                      <span className={ESTADO[c.estado].clase}>
                        {ESTADO[c.estado].texto}
                        {c.diasAtraso > 0 ? ` (${c.diasAtraso} días)` : ""}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/** Pagos: cuotas vencidas sin cobrar de todos los clientes. */
export function CuotasVencidasPanel() {
  const vencidas = useCuotasVencidas();
  return (
    <Panel titulo="Cuotas vencidas" descripcion="Si pasan 7 días sin pagar, la cuenta del cliente queda en solo lectura">
      {vencidas.isPending ? (
        <CargandoFilas filas={2} />
      ) : vencidas.isError ? (
        <ErrorDatos error={vencidas.error} onReintentar={() => vencidas.refetch()} />
      ) : vencidas.data.length === 0 ? (
        <SinDatos mensaje="No hay cuotas vencidas." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Cuota</TableHead>
              <TableHead className="hidden md:table-cell">Venció</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {vencidas.data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="whitespace-normal">
                  <Link prefetch={false} href={`/admin/clientes/${c.empresaId}`} className="font-medium hover:underline">
                    {c.empresa}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {NOMBRE_PLAN(c.plan)} {NOMBRE_CICLO[c.ciclo]?.toLowerCase()}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {c.numero} de {c.cuotas}
                  <span className="block text-xs text-red-400">{c.diasAtraso} días de atraso</span>
                </TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">{fechaAR(c.vence)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatoPesos(c.monto)}</TableCell>
                <TableCell className="text-right">
                  <CobrarCuota empresaId={c.empresaId} cuota={c} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
