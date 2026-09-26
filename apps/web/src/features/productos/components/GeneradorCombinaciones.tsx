"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Atributo } from "../hooks/use-producto-editor";

interface Eje {
  atributo: string;
  valores: string[];
  /** Valores escritos a mano, separados por coma. */
  extra: string;
}

const ejeVacio = (atributo = ""): Eje => ({ atributo, valores: [], extra: "" });
const valoresDe = (e: Eje) => [...new Set([...e.valores, ...e.extra.split(",").map((v) => v.trim()).filter(Boolean)])];

/**
 * Arma todas las combinaciones de hasta dos atributos de una vez
 * (ej. Color: Negro, Marrón × Tamaño: Chico, Grande = 4 variantes).
 */
export function GeneradorCombinaciones({
  atributos,
  onGenerar,
}: {
  atributos: Atributo[];
  onGenerar: (combinaciones: { atributo: string; valor: string }[][]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [ejes, setEjes] = useState<Eje[]>([ejeVacio(atributos[0]?.nombre ?? "")]);

  const listas = ejes.filter((e) => e.atributo.trim()).map((e) => ({ atributo: e.atributo.trim(), valores: valoresDe(e) })).filter((e) => e.valores.length > 0);
  const combinaciones = listas.reduce<{ atributo: string; valor: string }[][]>(
    (acc, eje) => acc.flatMap((combo) => eje.valores.map((valor) => [...combo, { atributo: eje.atributo, valor }])),
    listas.length ? [[]] : [],
  );

  const cambiar = (i: number, cambios: Partial<Eje>) => setEjes((prev) => prev.map((e, j) => (j === i ? { ...e, ...cambios } : e)));

  if (!abierto) {
    return (
      <Button variant="outline" className="self-start" onClick={() => setAbierto(true)}>
        <Wand2 aria-hidden /> Generar combinaciones
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
      <p className="text-sm font-medium">Elegí los atributos y sus valores: se crea una variante por cada combinación.</p>
      {ejes.map((eje, i) => {
        const sugeridos = atributos.find((a) => a.nombre === eje.atributo)?.valores ?? [];
        return (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="w-36"
                list="atributos-nombres"
                placeholder="Atributo (ej. Color)"
                aria-label={`Atributo ${i + 1}`}
                value={eje.atributo}
                onChange={(e) => cambiar(i, { atributo: e.target.value, valores: [] })}
              />
              <Input
                className="min-w-48 flex-1"
                placeholder={sugeridos.length ? "Otros valores, separados por coma" : "Valores separados por coma (ej. Negro, Marrón)"}
                aria-label={`Valores de ${eje.atributo || `atributo ${i + 1}`}`}
                value={eje.extra}
                onChange={(e) => cambiar(i, { extra: e.target.value })}
              />
            </div>
            {sugeridos.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sugeridos.map((v) => {
                  const elegido = eje.valores.includes(v);
                  return (
                    <Button
                      key={v}
                      size="sm"
                      variant={elegido ? "secondary" : "ghost"}
                      aria-pressed={elegido}
                      onClick={() => cambiar(i, { valores: elegido ? eje.valores.filter((x) => x !== v) : [...eje.valores, v] })}
                    >
                      {v}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        {ejes.length < 2 && (
          <Button size="sm" variant="ghost" onClick={() => setEjes((prev) => [...prev, ejeVacio(atributos.find((a) => a.nombre !== prev[0].atributo)?.nombre ?? "")])}>
            + Segundo atributo
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{combinaciones.length} variantes</span>
        <Button variant="ghost" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button
          disabled={combinaciones.length === 0}
          onClick={() => {
            onGenerar(combinaciones);
            setAbierto(false);
            setEjes([ejeVacio(atributos[0]?.nombre ?? "")]);
          }}
        >
          Crear {combinaciones.length || ""} variantes
        </Button>
      </div>
    </div>
  );
}
