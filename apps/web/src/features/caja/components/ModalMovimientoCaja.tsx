"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRegistrarMovimiento } from "../hooks/use-caja";

interface Props {
  abierto: boolean;
  cajaId: string;
  onCerrar: () => void;
}

export function ModalMovimientoCaja({ abierto, cajaId, onCerrar }: Props) {
  const [tipo, setTipo] = useState<"egreso" | "ingreso">("egreso");
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [comprobanteRef, setComprobanteRef] = useState("");
  const registrar = useRegistrarMovimiento();

  if (!abierto) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const montoNum = Number(monto.replace(/\./g, "").replace(",", ".")) || 0;
    if (montoNum <= 0) {
      toast.error("El monto debe ser mayor a cero.");
      return;
    }
    if (!concepto.trim()) {
      toast.error("El motivo o concepto es obligatorio.");
      return;
    }

    try {
      await registrar.mutateAsync({
        cajaId,
        tipo,
        monto: montoNum,
        concepto: concepto.trim(),
        comprobanteRef: comprobanteRef.trim() || undefined,
      });
      toast.success(
        tipo === "egreso"
          ? "Sangría / Retiro registrado correctamente"
          : "Ingreso extraordinario registrado correctamente",
      );
      onCerrar();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar el movimiento.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-semibold">Movimiento de Caja</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Selector de Tipo: Sangría (Egreso) vs Ingreso */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setTipo("egreso")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              tipo === "egreso"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDownRight className="size-4" /> Sangría (Retiro)
          </button>
          <button
            type="button"
            onClick={() => setTipo("ingreso")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              tipo === "ingreso"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowUpRight className="size-4" /> Ingreso Extra
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-foreground">
              {tipo === "egreso" ? "Monto a retirar ($) *" : "Monto a ingresar ($) *"}
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-2.5 text-sm font-semibold text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                autoFocus
                placeholder="2500"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="pl-7 font-mono text-base font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">
              Concepto / Motivo *
            </label>
            <Input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={
                tipo === "egreso"
                  ? "Ej. Pago a proveedor de hielo / Retiro de seguridad"
                  : "Ej. Cambio extra traído de caja fuerte"
              }
              required
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">
              N° Comprobante / Recibo (Opcional)
            </label>
            <Input
              value={comprobanteRef}
              onChange={(e) => setComprobanteRef(e.target.value)}
              placeholder="Ej. Recibo N° 0041-0021"
              className="mt-1"
            />
          </div>

          <div className="mt-2 flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={registrar.isPending}
              className={
                tipo === "egreso"
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
            >
              {registrar.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
              {tipo === "egreso" ? "Registrar Sangría" : "Registrar Ingreso"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
