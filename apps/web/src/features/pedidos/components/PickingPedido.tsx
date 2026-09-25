"use client";

import { useState } from "react";
import { Camera, Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatoPesos } from "@/lib/formato";
import { EscanerCamara } from "@/features/productos/components/EscanerCamara";
import { etiquetaItem, type PedidoItem } from "../types";

/**
 * Preparación del pedido (picking): cada unidad se marca a mano o escaneando
 * su código de barras / SKU (lector USB o cámara). Puerto del picking del legacy.
 */
export function PickingPedido({
  items,
  bloqueado,
  onPreparar,
}: {
  items: PedidoItem[];
  bloqueado: boolean;
  onPreparar: (item: PedidoItem, cantidadPreparada: number) => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [camara, setCamara] = useState(false);
  // Conteo optimista: dos escaneos seguidos no pueden esperar a que vuelva
  // la respuesta del servidor (el segundo partiría del valor viejo).
  const [local, setLocal] = useState<Record<string, number>>({});
  const cant = (i: PedidoItem) => local[i.id] ?? i.cantidadPreparada;
  const preparar = (i: PedidoItem, n: number) => {
    setLocal((l) => ({ ...l, [i.id]: n }));
    onPreparar(i, n);
  };
  const unidades = items.reduce((acc, i) => acc + i.cantidad, 0);
  const preparadas = items.reduce((acc, i) => acc + Math.min(cant(i), i.cantidad), 0);

  function escaneado(valor: string) {
    const c = valor.trim();
    if (!c) return;
    // SKU identifica la variante exacta; el código de barras es del producto:
    // si hay varias variantes con el mismo código, va a la primera incompleta.
    const candidatos = items.filter((i) => i.sku === c || i.codigoBarra === c);
    if (candidatos.length === 0) return toast.error(`El código ${c} no está en este pedido`);
    const item = candidatos.find((i) => cant(i) < i.cantidad);
    if (!item) return toast.warning(`Ya preparaste todas las unidades de ${etiquetaItem(candidatos[0])}`);
    const nueva = cant(item) + 1;
    preparar(item, nueva);
    if (nueva === item.cantidad) toast.success(`${etiquetaItem(item)} completo (${nueva}/${item.cantidad})`);
    else toast.success(`${etiquetaItem(item)}: ${nueva}/${item.cantidad}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={preparadas} aria-valuemax={unidades}>
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${unidades ? (preparadas / unidades) * 100 : 0}%` }} />
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {preparadas}/{unidades} unidades
        </span>
      </div>

      {!bloqueado && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              placeholder="Escaneá el código de barras o SKU"
              aria-label="Escanear producto"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  escaneado(codigo);
                  setCodigo("");
                }
              }}
            />
            {!camara && (
              <Button variant="outline" onClick={() => setCamara(true)}>
                <Camera aria-hidden /> Escanear
              </Button>
            )}
          </div>
          {camara && <EscanerCamara onCodigo={escaneado} onCerrar={() => setCamara(false)} />}
        </div>
      )}

      <ul className="flex flex-col divide-y">
        {items.map((i) => {
          const n = cant(i);
          const completo = n >= i.cantidad;
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span
                className={`flex size-6 items-center justify-center rounded-full border ${completo ? "border-emerald-500 bg-emerald-500 text-white" : ""}`}
                aria-hidden
              >
                {completo && <Check className="size-4" />}
              </span>
              <div className="min-w-40 flex-1">
                <p className="font-medium">{etiquetaItem(i)}</p>
                <p className="text-xs text-muted-foreground">
                  {[i.sku && `SKU ${i.sku}`, i.codigoBarra && `Cód. ${i.codigoBarra}`, formatoPesos(i.precioUnitario)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label={`Quitar una unidad preparada de ${etiquetaItem(i)}`}
                  disabled={bloqueado || n <= 0}
                  onClick={() => preparar(i, n - 1)}
                >
                  <Minus />
                </Button>
                <span className="w-14 text-center tabular-nums">
                  {n}/{i.cantidad}
                </span>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label={`Sumar una unidad preparada de ${etiquetaItem(i)}`}
                  disabled={bloqueado || completo}
                  onClick={() => preparar(i, n + 1)}
                >
                  <Plus />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
