"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useCerrarCaja } from "../hooks/use-caja";
import { formatoPesos } from "@/lib/formato";
import type { ResumenReporteXZ } from "../types/caja.types";
import { TicketReporteXZ } from "./TicketReporteXZ";

interface Props {
  abierto: boolean;
  cajaId: string;
  onCerrar: () => void;
}

export function ModalArqueoCierre({ abierto, cajaId, onCerrar }: Props) {
  const [montoDeclarado, setMontoDeclarado] = useState("");
  const [notas, setNotas] = useState("");
  const [reporteFinal, setReporteFinal] = useState<ResumenReporteXZ | null>(null);
  const cerrarCaja = useCerrarCaja();

  if (!abierto) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const monto = Number(montoDeclarado.replace(/\./g, "").replace(",", ".")) || 0;

    try {
      const z = await cerrarCaja.mutateAsync({
        cajaId,
        montoDeclarado: monto,
        notasCierre: notas.trim() || undefined,
      });
      setReporteFinal(z);
      toast.success("Turno cerrado y Reporte Z generado con éxito.");
    } catch (err: any) {
      toast.error(err.message || "Error al cerrar el turno.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400">
              <Lock className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {reporteFinal ? "Resumen de Cierre y Reporte Z" : "Arqueo Ciego y Cierre de Turno"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {reporteFinal
                  ? "Turno finalizado con éxito. Podés imprimir el comprobante."
                  : "Contá el dinero físico presente en el cajón para el arqueo."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        {!reporteFinal ? (
          /* Paso 1: Ingreso de Arqueo Ciego */
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Procedimiento de Arqueo Ciego:</p>
                  <p className="mt-0.5 opacity-90">
                    Ingresá el importe total de billetes y monedas contados en el cajón. El sistema
                    no revelará el saldo esperado hasta que confirmes el cierre para garantizar la
                    transparencia del turno.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">
                Total de Efectivo Físico Contado ($) *
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2.5 text-base font-bold text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={montoDeclarado}
                  onChange={(e) => setMontoDeclarado(e.target.value)}
                  className="pl-8 font-mono text-xl font-bold h-12"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">
                Observaciones o notas de cierre (Opcional)
              </label>
              <Input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej. Se dejaron $5.000 para el turno de la tarde"
                className="mt-1"
              />
            </div>

            <div className="mt-3 flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={cerrarCaja.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                Confirmar Arqueo y Cerrar Turno
              </Button>
            </div>
          </form>
        ) : (
          /* Paso 2: Resultado de la Diferencia y Reporte Z */
          <div className="mt-5 flex flex-col gap-5">
            {/* Banner de Resultado */}
            <div
              className={`rounded-xl border p-4 text-center ${
                (reporteFinal.diferencia ?? 0) === 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : (reporteFinal.diferencia ?? 0) > 0
                    ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="size-5" />
                <span className="text-sm font-bold uppercase tracking-wider">
                  {(reporteFinal.diferencia ?? 0) === 0
                    ? "¡Arqueo Exacto! Caja sin diferencias"
                    : (reporteFinal.diferencia ?? 0) > 0
                      ? `Sobrante de Caja: +${formatoPesos(reporteFinal.diferencia ?? 0)}`
                      : `Faltante de Caja: ${formatoPesos(reporteFinal.diferencia ?? 0)}`}
                </span>
              </div>
              <div className="mt-2 flex justify-center gap-6 text-xs opacity-90">
                <span>
                  Esperado: <b>{formatoPesos(reporteFinal.efectivoEsperado)}</b>
                </span>
                <span>
                  Declarado: <b>{formatoPesos(reporteFinal.montoDeclarado ?? 0)}</b>
                </span>
              </div>
            </div>

            {/* Vista del Ticket Térmico Z */}
            <div className="flex justify-center bg-muted/40 p-3 rounded-xl overflow-y-auto max-h-[50vh]">
              <TicketReporteXZ reporte={reporteFinal} />
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button onClick={onCerrar} className="w-full sm:w-auto font-medium">
                Finalizar y Continuar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
