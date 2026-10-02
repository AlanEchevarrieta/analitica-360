"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { descargarCsv } from "@/lib/csv";
import { formatoPesos } from "@/lib/formato";
import { hoyAR } from "@/lib/periodos";
import { NOMBRE_PLAN } from "../../hooks/use-admin";
import { fechaAR, NOMBRE_CICLO, useAccionesAlianzas, useLiquidacion, useMesesCamara, type Ciclo } from "../../hooks/use-alianzas";
import { Panel } from "../comunes";

const ESTADO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "text-amber-400" },
  aprobada: { texto: "Aprobada", clase: "text-sky-400" },
  pagada: { texto: "Pagada", clase: "text-emerald-400" },
};
const nombreMes = (m: string) => {
  const t = new Date(`${m}-15T12:00:00Z`).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Liquidación mensual de la cámara: ver el detalle → aprobar → marcar pagada, y exportar para mandarle a la cámara. */
export function LiquidacionPanel({ camaraId, camaraNombre }: { camaraId: string; camaraNombre: string }) {
  const meses = useMesesCamara(camaraId);
  const [mes, setMes] = useState(hoyAR().slice(0, 7));
  const liq = useLiquidacion(camaraId, mes);
  const { aprobarLiquidacion, pagarLiquidacion } = useAccionesAlianzas();
  const [pago, setPago] = useState({ fecha: hoyAR(), referencia: "" });
  const d = liq.data;

  const opciones = [...new Set([hoyAR().slice(0, 7), ...(meses.data ?? []).map((m) => m.mes)])].sort().reverse();

  function exportar() {
    if (!d || d.lineas.length === 0) return;
    descargarCsv(
      `comisiones-${camaraNombre.toLowerCase().replace(/\s+/g, "-")}-${mes}`,
      d.lineas.map((l) => ({
        "N.º cliente": l.orden ?? "",
        Empresa: l.empresa,
        Tipo: l.tipo === "ajuste" ? "Ajuste por devolución" : "Pago",
        Plan: l.plan ? NOMBRE_PLAN(l.plan) : "",
        Ciclo: l.ciclo ? NOMBRE_CICLO[l.ciclo as Ciclo] : "",
        Cuota: l.cuota ?? "",
        "Precio de lista": l.precioLista,
        "Cobrado (base)": l.base,
        "Parte dentro del plazo": `${Math.round(l.proporcion * 100)}%`,
        "Porcentaje": `${l.porcentaje}%`,
        Comisión: l.monto,
        "Período desde": fechaAR(l.periodoDesde),
        "Período hasta": fechaAR(l.periodoHasta),
      })),
    );
  }

  return (
    <Panel
      titulo="Liquidación mensual"
      descripcion="Las comisiones de los cobros del mes. Una vez aprobada no cambia: lo que se cobre o devuelva después va al mes siguiente."
      accion={
        <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Mes" value={mes} onChange={(e) => setMes(e.target.value)}>
          {opciones.map((m) => (
            <option key={m} value={m}>
              {nombreMes(m)}
            </option>
          ))}
        </select>
      }
    >
      {liq.isError ? (
        <ErrorDatos error={liq.error} onReintentar={() => liq.refetch()} />
      ) : !d ? (
        <CargandoFilas filas={3} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-2xl font-semibold tabular-nums">{formatoPesos(d.total)}</span>
            <span className={`text-sm font-medium ${ESTADO[d.estado].clase}`}>{ESTADO[d.estado].texto}</span>
            {d.aprobadaEn && <span className="text-xs text-muted-foreground">Aprobada el {fechaAR(d.aprobadaEn)} por {d.aprobadaPor}</span>}
            {d.pagadaEn && <span className="text-xs text-muted-foreground">Pagada el {fechaAR(d.pagadaEn)} · {d.referencia}</span>}
          </div>

          {d.lineas.length === 0 ? (
            <SinDatos mensaje="No hay comisiones en este mes." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="hidden md:table-cell">Plan</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Cobrado</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Dentro del plazo</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.lineas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      {l.orden != null && <span className="text-muted-foreground tabular-nums">#{l.orden} </span>}
                      {l.empresa}
                      {l.tipo === "ajuste" && <span className="block text-xs text-red-400">Ajuste por devolución</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {l.plan ? `${NOMBRE_PLAN(l.plan)} ${NOMBRE_CICLO[l.ciclo as Ciclo]?.toLowerCase() ?? ""}` : "—"}
                      {l.cuota && <span className="block text-xs text-muted-foreground">Cuota {l.cuota}</span>}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{formatoPesos(l.base)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{Math.round(l.proporcion * 100)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{l.porcentaje}%</TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${l.monto < 0 ? "text-red-400" : ""}`}>{formatoPesos(l.monto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportar} disabled={d.lineas.length === 0}>
              Exportar (Excel / CSV)
            </Button>
            {d.estado === "pendiente" && d.lineas.length > 0 && (
              <Button
                disabled={aprobarLiquidacion.isPending}
                onClick={() =>
                  aprobarLiquidacion.mutate({ camaraId, mes }, { onSuccess: () => toast.success("Liquidación aprobada"), onError: (e) => toast.error(e.message) })
                }
              >
                Aprobar liquidación
              </Button>
            )}
            {d.estado === "aprobada" && d.id && (
              <>
                <Input type="date" className="w-40" aria-label="Fecha de pago" value={pago.fecha} onChange={(e) => setPago({ ...pago, fecha: e.target.value })} />
                <Input className="w-56" placeholder="Referencia (n.º de transferencia)" aria-label="Referencia" value={pago.referencia} onChange={(e) => setPago({ ...pago, referencia: e.target.value })} />
                <Button
                  disabled={pagarLiquidacion.isPending || !pago.referencia.trim()}
                  onClick={() =>
                    pagarLiquidacion.mutate({ id: d.id!, ...pago }, { onSuccess: () => toast.success("Liquidación marcada como pagada"), onError: (e) => toast.error(e.message) })
                  }
                >
                  Marcar pagada
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
