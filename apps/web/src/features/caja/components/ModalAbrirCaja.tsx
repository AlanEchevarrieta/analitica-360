"use client";

import { useState } from "react";
import { Coins, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAbrirCaja } from "../hooks/use-caja";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

export function ModalAbrirCaja({ abierto, onCerrar }: Props) {
  const [montoInicial, setMontoInicial] = useState("");
  const [nombreCaja, setNombreCaja] = useState("Caja Principal");
  const [notas, setNotas] = useState("");
  const abrirCaja = useAbrirCaja();

  if (!abierto) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const monto = Number(montoInicial.replace(/\./g, "").replace(",", ".")) || 0;

    try {
      await abrirCaja.mutateAsync({
        montoInicial: monto,
        nombreCaja: nombreCaja.trim() || "Caja Principal",
        notasApertura: notas.trim() || undefined,
      });
      toast.success("¡Turno de caja abierto con éxito!");
      onCerrar();
    } catch (err: any) {
      toast.error(err.message || "Error al abrir la caja");
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
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <Coins className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Apertura de Turno de Caja</h2>
              <p className="text-xs text-muted-foreground">
                Ingresá el cambio inicial para comenzar a cobrar.
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

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-foreground">
              Fondo Inicial de Caja (Cambio en efectivo) *
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-2.5 text-sm font-semibold text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                autoFocus
                placeholder="10000"
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
                className="pl-7 font-mono text-base font-bold"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Billetes y monedas presentes en el cajón al iniciar el turno.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">
              Nombre o Identificador del Turno
            </label>
            <Input
              value={nombreCaja}
              onChange={(e) => setNombreCaja(e.target.value)}
              placeholder="Ej. Caja 1 - Turno Mañana"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">
              Notas iniciales (Opcional)
            </label>
            <Input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej. Se recibió cambio de billetes chicos"
              className="mt-1"
            />
          </div>

          <div className="mt-2 flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={abrirCaja.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium"
            >
              {abrirCaja.isPending && <Loader2 className="size-4 animate-spin" />}
              Abrir Turno
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
