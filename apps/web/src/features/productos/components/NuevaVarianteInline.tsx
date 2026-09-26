"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiFetch } from "@/hooks/use-api";
import type { VarianteProducto } from "../types";

const OTRO = "__otro__";
const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";

/**
 * Alta de variantes desde una compra (ej. llegó un color nuevo, o un producto
 * que hasta ahora no tenía variantes). Acepta varios valores separados por
 * coma. La API reemplaza la lista completa de variantes, así que se relee la
 * actual y se manda entera + las nuevas. Si el producto tenía stock sin
 * variante, antes pregunta de qué variante es.
 */
export function NuevaVarianteInline({
  productoId,
  atributoSugerido,
  abiertoInicial = false,
  onCreada,
  onCancelar,
}: {
  productoId: string;
  atributoSugerido: string;
  abiertoInicial?: boolean;
  onCreada: (variante: VarianteProducto) => void;
  onCancelar?: () => void;
}) {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [atributo, setAtributo] = useState(atributoSugerido);
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stock que el producto ya tenía sin variante: hay que decir de cuál es.
  const [stockSuelto, setStockSuelto] = useState(0);
  const [destino, setDestino] = useState("");
  const [otroValor, setOtroValor] = useState("");

  const valores = [...new Set(valor.split(",").map((v) => v.trim()).filter(Boolean))];

  async function crear() {
    const attr = atributo.trim();
    if (!attr || valores.length === 0) return setError("Completá el atributo y al menos un valor.");
    setEnviando(true);
    setError(null);
    try {
      const actuales = await api<VarianteProducto[]>(`/productos/${productoId}/variantes`);
      // Solo cuando todavía no tiene variantes activas puede haber stock suelto.
      if (!stockSuelto && !actuales.some((v) => v.activo)) {
        const { stock } = await api<{ stock: number }>(`/productos/${productoId}/variantes/sin-asignar`);
        if (stock > 0) {
          setStockSuelto(stock);
          setDestino(valores[0]);
          return;
        }
      }
      const valorDestino = destino === OTRO ? otroValor.trim() : destino;
      if (stockSuelto > 0 && !valorDestino) return setError("Escribí de qué variante son las unidades que ya tenías.");

      const nuevas = [...valores, ...(stockSuelto > 0 && !valores.includes(valorDestino) ? [valorDestino] : [])];
      const lista = await api<VarianteProducto[]>(`/productos/${productoId}/variantes`, {
        method: "PUT",
        body: JSON.stringify({
          variantes: [...actuales, ...nuevas.map((v) => ({ sku: null, atributos: { [attr]: v }, precioVenta: null, costo: null, activo: true }))],
          ...(stockSuelto > 0 ? { repartoSinVariante: [{ atributos: { [attr]: valorDestino }, cantidad: stockSuelto }] } : {}),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["variantes"] });
      await queryClient.invalidateQueries({ queryKey: ["productos"] });
      for (const v of valores) {
        const creada = lista.find((x) => x.atributos[attr] === v && Object.keys(x.atributos).length === 1);
        if (creada) onCreada(creada);
      }
      setAbierto(false);
      setValor("");
      setStockSuelto(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la variante.");
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <Button variant="ghost" onClick={() => setAbierto(true)}>
        <Plus aria-hidden /> Nueva variante
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-32" list="atributos-nombres" placeholder="Atributo (ej. Color)" aria-label="Atributo de la nueva variante" value={atributo} onChange={(e) => setAtributo(e.target.value)} />
        <Input
          className="min-w-48 flex-1"
          placeholder="Valores (ej. Negro, Marrón)"
          aria-label="Valores de la nueva variante"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setStockSuelto(0);
          }}
          onKeyDown={(e) => e.key === "Enter" && void crear()}
          autoFocus
        />
      </div>
      {stockSuelto > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 p-2 text-sm ring-1 ring-amber-500/30">
          <span>
            Ya tenías <b>{stockSuelto} unidades</b> cargadas sin variante. ¿De qué {atributo.trim().toLowerCase() || "variante"} son?
          </span>
          <select className={selectClase} aria-label="Variante del stock que ya tenías" value={destino} onChange={(e) => setDestino(e.target.value)}>
            {valores.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
            <option value={OTRO}>Otra…</option>
          </select>
          {destino === OTRO && <Input className="w-36" placeholder="Ej. Natural" aria-label="Otra variante" value={otroValor} onChange={(e) => setOtroValor(e.target.value)} />}
          <span className="w-full text-xs text-muted-foreground">Si son de varias variantes, cancelá y cargalas desde la ficha del producto (Productos → Variantes), donde se pueden repartir.</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void crear()} disabled={enviando}>
          {valores.length > 1 ? `Crear ${valores.length} y agregar` : "Crear y agregar"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setAbierto(false);
            setStockSuelto(0);
            onCancelar?.();
          }}
        >
          Cancelar
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
