"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCategorias, useCrearCategoria } from "../hooks/use-producto-editor";

const NUEVA = "__nueva__";

/** Select de categoría con alta rápida ("+ Nueva categoría…") sin salir del producto. */
export function CategoriaSelector({ valor, onCambiar }: { valor: string | null; onCambiar: (id: string | null) => void }) {
  const categorias = useCategorias();
  const crear = useCrearCategoria();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");

  function confirmar() {
    if (!nombre.trim()) return;
    crear.mutate(nombre.trim(), {
      onSuccess: (c) => {
        onCambiar(c.id);
        setCreando(false);
        setNombre("");
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo crear la categoría"),
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="producto-categoria">Categoría</Label>
      {creando ? (
        <div className="flex gap-2">
          <Input
            placeholder="Nombre de la categoría"
            aria-label="Nombre de la nueva categoría"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmar()}
            autoFocus
          />
          <Button onClick={confirmar} disabled={crear.isPending}>
            Crear
          </Button>
          <Button variant="ghost" onClick={() => setCreando(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <select
          id="producto-categoria"
          className="h-8 rounded-lg border bg-transparent px-2 text-sm"
          value={valor ?? ""}
          onChange={(e) => {
            if (e.target.value === NUEVA) setCreando(true);
            else onCambiar(e.target.value || null);
          }}
        >
          <option value="">Sin categoría</option>
          {(categorias.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
          <option value={NUEVA}>+ Nueva categoría…</option>
        </select>
      )}
    </div>
  );
}
