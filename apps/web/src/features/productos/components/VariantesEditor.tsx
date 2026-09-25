"use client";

import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Atributo } from "../hooks/use-producto-editor";

export interface VarianteEditable {
  /** Clave local de la fila (las nuevas no tienen id todavía). */
  clave: string;
  id?: string;
  pares: { atributo: string; valor: string }[];
  sku: string;
  precio: string;
  costo: string;
  activo: boolean;
  stock: number;
}

export function varianteNueva(atributoSugerido = ""): VarianteEditable {
  return {
    clave: crypto.randomUUID(),
    pares: [{ atributo: atributoSugerido, valor: "" }],
    sku: "",
    precio: "",
    costo: "",
    activo: true,
    stock: 0,
  };
}

export function VariantesEditor({
  variantes,
  onCambiar,
  atributos,
}: {
  variantes: VarianteEditable[];
  onCambiar: (variantes: VarianteEditable[]) => void;
  atributos: Atributo[];
}) {
  const actualizar = (clave: string, cambios: Partial<VarianteEditable>) =>
    onCambiar(variantes.map((v) => (v.clave === clave ? { ...v, ...cambios } : v)));
  const primerAtributo = variantes[0]?.pares[0]?.atributo || atributos[0]?.nombre || "";

  return (
    <div className="flex flex-col gap-3">
      <datalist id="atributos-nombres">
        {atributos.map((a) => (
          <option key={a.id} value={a.nombre} />
        ))}
      </datalist>
      {atributos.map((a) => (
        <datalist key={a.id} id={`atributo-valores-${a.nombre}`}>
          {a.valores.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      ))}

      {variantes.map((v) => (
        <div key={v.clave} className={`flex flex-col gap-2 rounded-lg border p-3 ${v.activo ? "" : "opacity-60"}`}>
          <div className="flex flex-wrap items-center gap-2">
            {v.pares.map((par, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  className="w-28"
                  list="atributos-nombres"
                  placeholder="Atributo"
                  aria-label="Atributo (ej. Color)"
                  value={par.atributo}
                  onChange={(e) =>
                    actualizar(v.clave, { pares: v.pares.map((p, j) => (j === i ? { ...p, atributo: e.target.value } : p)) })
                  }
                />
                <Input
                  className="w-28"
                  list={`atributo-valores-${par.atributo}`}
                  placeholder="Valor"
                  aria-label="Valor (ej. Negro)"
                  value={par.valor}
                  onChange={(e) =>
                    actualizar(v.clave, { pares: v.pares.map((p, j) => (j === i ? { ...p, valor: e.target.value } : p)) })
                  }
                />
                {v.pares.length > 1 && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Quitar atributo"
                    onClick={() => actualizar(v.clave, { pares: v.pares.filter((_, j) => j !== i) })}
                  >
                    <X />
                  </Button>
                )}
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => actualizar(v.clave, { pares: [...v.pares, { atributo: "", valor: "" }] })}
            >
              <Plus aria-hidden /> Atributo
            </Button>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">Stock: {v.stock}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-36" placeholder="SKU (opcional)" aria-label="SKU" value={v.sku} onChange={(e) => actualizar(v.clave, { sku: e.target.value })} />
            <Input
              className="w-32"
              inputMode="decimal"
              placeholder="Precio"
              aria-label="Precio de la variante"
              value={v.precio}
              onChange={(e) => actualizar(v.clave, { precio: e.target.value })}
            />
            <Input
              className="w-32"
              inputMode="decimal"
              placeholder="Costo"
              aria-label="Costo de la variante"
              value={v.costo}
              onChange={(e) => actualizar(v.clave, { costo: e.target.value })}
            />
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={v.activo} onChange={(e) => actualizar(v.clave, { activo: e.target.checked })} />
              Activa
            </label>
            {!v.id && (
              <Button
                size="icon-sm"
                variant="ghost"
                className="ml-auto"
                aria-label="Quitar variante"
                onClick={() => onCambiar(variantes.filter((x) => x.clave !== v.clave))}
              >
                <Trash2 />
              </Button>
            )}
          </div>
          {!v.activo && v.stock !== 0 && (
            <p className="text-xs text-destructive">
              Tiene {v.stock} en stock: para desactivarla primero vendé, transferí o ajustá ese stock a 0.
            </p>
          )}
        </div>
      ))}

      <Button variant="outline" className="self-start" onClick={() => onCambiar([...variantes, varianteNueva(primerAtributo)])}>
        <Plus aria-hidden /> Agregar variante
      </Button>
      <p className="text-xs text-muted-foreground">
        Precio y costo vacíos = los del producto. Las variantes con ventas no se borran: se desactivan.
      </p>
    </div>
  );
}
