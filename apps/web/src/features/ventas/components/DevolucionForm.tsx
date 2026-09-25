"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatoPesos } from "@/lib/formato";
import { BuscadorProductos } from "@/features/productos/components/BuscadorProductos";
import { LineasProductos } from "@/features/productos/components/LineasProductos";
import type { LineaProducto } from "@/features/productos/types";
import { useAccionesVenta, type VentaDetalle } from "../hooks/use-venta";

const etiqueta = (i: { productoNombre: string; varianteEtiqueta: string | null }) =>
  i.varianteEtiqueta ? `${i.productoNombre} (${i.varianteEtiqueta})` : i.productoNombre;

/**
 * Devolución (el cliente trae y se le reintegra) o cambio (trae y se lleva
 * otra cosa). Lo que trae sale de esta venta: como máximo lo vendido menos lo
 * ya devuelto; el precio es el de la venta (la API lo impone igual).
 */
export function DevolucionForm({ venta, onHecho }: { venta: VentaDetalle; onHecho: () => void }) {
  const { devolver } = useAccionesVenta(venta.id);
  const [tipo, setTipo] = useState<"devolucion" | "cambio">("devolucion");
  const [trae, setTrae] = useState<Record<number, number>>({});
  const [lleva, setLleva] = useState<LineaProducto[]>([]);
  const [motivo, setMotivo] = useState("");

  const disponibles = venta.items.map((i) => Math.max(0, i.cantidad - i.devueltas));
  const valorTrae = venta.items.reduce((acc, i, idx) => acc + (trae[idx] ?? 0) * i.precioUnitario, 0);
  const valorLleva = tipo === "cambio" ? lleva.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0) : 0;
  const diferencia = valorLleva - valorTrae;

  function registrar() {
    const items = [
      ...venta.items
        .map((i, idx) => ({ i, n: trae[idx] ?? 0 }))
        .filter((x) => x.n > 0)
        .map(({ i, n }) => ({ productoId: i.productoId, varianteId: i.varianteId, cantidad: n, precioUnitario: i.precioUnitario, tipo: "devuelto" as const })),
      ...(tipo === "cambio"
        ? lleva.map((l) => ({ productoId: l.productoId, varianteId: l.varianteId, cantidad: l.cantidad, precioUnitario: l.precioUnitario, tipo: "entregado" as const }))
        : []),
    ];
    if (!items.some((x) => x.tipo === "devuelto")) return toast.error("Elegí qué trae el cliente.");
    if (tipo === "cambio" && lleva.length === 0) return toast.error("En un cambio, elegí qué se lleva el cliente.");
    devolver.mutate(
      { tipo, ventaId: venta.id, motivo: motivo.trim() || null, items },
      {
        onSuccess: () => {
          toast.success(tipo === "cambio" ? "Cambio registrado" : `Devolución registrada: reintegro de ${formatoPesos(valorTrae)}`);
          onHecho();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex gap-1" role="group" aria-label="Tipo">
        {(["devolucion", "cambio"] as const).map((t) => (
          <Button key={t} size="sm" variant={tipo === t ? "default" : "outline"} aria-pressed={tipo === t} onClick={() => setTipo(t)}>
            {t === "devolucion" ? "Devolución (se reintegra)" : "Cambio por otro producto"}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">¿Qué trae el cliente?</p>
        {venta.items.map((i, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {etiqueta(i)} <span className="text-muted-foreground">· {formatoPesos(i.precioUnitario)} · disponibles {disponibles[idx]}</span>
            </span>
            <Input
              className="w-20 text-center tabular-nums"
              inputMode="numeric"
              aria-label={`Unidades que trae de ${etiqueta(i)}`}
              disabled={disponibles[idx] === 0}
              value={trae[idx] ?? 0}
              onChange={(e) => {
                const n = Math.min(disponibles[idx], Math.max(0, Number.parseInt(e.target.value, 10) || 0));
                setTrae((t) => ({ ...t, [idx]: n }));
              }}
            />
          </div>
        ))}
      </div>

      {tipo === "cambio" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">¿Qué se lleva?</p>
          <BuscadorProductos
            onAgregar={(nueva) =>
              setLleva((prev) =>
                prev.some((l) => l.clave === nueva.clave)
                  ? prev.map((l) => (l.clave === nueva.clave ? { ...l, cantidad: l.cantidad + 1 } : l))
                  : [...prev, { ...nueva, cantidad: 1 }],
              )
            }
          />
          <LineasProductos
            lineas={lleva}
            vacio="Buscá el producto que se lleva."
            onCambiar={(clave, cambios) => setLleva((prev) => prev.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)))}
            onQuitar={(clave) => setLleva((prev) => prev.filter((l) => l.clave !== clave))}
          />
        </div>
      )}

      <Input placeholder="Motivo (opcional): falla, talle, no le gustó…" aria-label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />

      <p className="text-sm">
        {tipo === "devolucion" || diferencia < 0 ? (
          <>Le devolvés al cliente <span className="font-semibold">{formatoPesos(Math.abs(tipo === "devolucion" ? valorTrae : diferencia))}</span></>
        ) : diferencia > 0 ? (
          <>El cliente te paga la diferencia: <span className="font-semibold">{formatoPesos(diferencia)}</span></>
        ) : (
          <>Cambio sin diferencia de plata</>
        )}
      </p>
      <Button onClick={registrar} disabled={devolver.isPending}>
        {devolver.isPending && <Loader2 className="animate-spin" aria-hidden />}
        Registrar {tipo === "cambio" ? "cambio" : "devolución"}
      </Button>
    </div>
  );
}
