"use client";

import { ArrowDownRight, ArrowUpRight, Receipt } from "lucide-react";
import { formatoPesos } from "@/lib/formato";
import type { MovimientoCaja } from "../types/caja.types";

interface Props {
  movimientos: MovimientoCaja[];
}

export function TablaMovimientosCaja({ movimientos }: Props) {
  if (movimientos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center text-muted-foreground">
        <Receipt className="size-8 opacity-40 mb-2" />
        <p className="text-xs font-medium">No hay sangrías ni ingresos registrados en este turno.</p>
        <span className="text-[11px] opacity-70">
          Usá el botón &quot;+ Registrar Movimiento&quot; para registrar pagos a repartidores o extracciones.
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b bg-muted/50 font-medium text-muted-foreground uppercase text-[10px]">
          <tr>
            <th className="py-2.5 px-3">Hora</th>
            <th className="py-2.5 px-3">Tipo</th>
            <th className="py-2.5 px-3">Concepto</th>
            <th className="py-2.5 px-3">Comprobante</th>
            <th className="py-2.5 px-3">Cajero</th>
            <th className="py-2.5 px-3 text-right">Monto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {movimientos.map((m) => {
            const esEgreso = m.tipo === "egreso";
            const hora = new Date(m.fecha).toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">{hora}</td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      esEgreso
                        ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {esEgreso ? (
                      <>
                        <ArrowDownRight className="size-3" /> Sangría
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="size-3" /> Ingreso
                      </>
                    )}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-medium text-foreground">{m.concepto}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{m.comprobanteRef || "—"}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{m.usuarioNombre}</td>
                <td
                  className={`py-2.5 px-3 text-right font-mono font-bold ${
                    esEgreso ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {esEgreso ? `-${formatoPesos(m.monto)}` : `+${formatoPesos(m.monto)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
