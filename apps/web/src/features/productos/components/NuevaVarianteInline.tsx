"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiFetch } from "@/hooks/use-api";
import type { VarianteProducto } from "../types";

/**
 * Alta de una variante desde una compra (ej. llegó un color nuevo). La API
 * reemplaza la lista completa de variantes (las que no vienen se
 * desactivan), así que se relee la lista actual y se manda entera + la nueva.
 */
export function NuevaVarianteInline({
  productoId,
  atributoSugerido,
  onCreada,
}: {
  productoId: string;
  atributoSugerido: string;
  onCreada: (variante: VarianteProducto) => void;
}) {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [atributo, setAtributo] = useState(atributoSugerido);
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    if (!atributo.trim() || !valor.trim()) return setError("Completá atributo y valor.");
    setEnviando(true);
    setError(null);
    try {
      const actuales = await api<VarianteProducto[]>(`/productos/${productoId}/variantes`);
      const nueva = { [atributo.trim()]: valor.trim() };
      const lista = await api<VarianteProducto[]>(`/productos/${productoId}/variantes`, {
        method: "PUT",
        body: JSON.stringify({ variantes: [...actuales, { sku: null, atributos: nueva, precioVenta: null, costo: null, activo: true }] }),
      });
      const creada = lista.find((v) => v.atributos[atributo.trim()] === valor.trim() && Object.keys(v.atributos).length === 1);
      await queryClient.invalidateQueries({ queryKey: ["variantes"] });
      if (creada) onCreada(creada);
      setAbierto(false);
      setValor("");
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
        <Input className="w-32" placeholder="Atributo" aria-label="Atributo de la nueva variante" value={atributo} onChange={(e) => setAtributo(e.target.value)} />
        <Input
          className="w-32"
          placeholder="Valor (ej. Verde)"
          aria-label="Valor de la nueva variante"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void crear()}
          autoFocus
        />
        <Button onClick={() => void crear()} disabled={enviando}>
          Crear y agregar
        </Button>
        <Button variant="ghost" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
