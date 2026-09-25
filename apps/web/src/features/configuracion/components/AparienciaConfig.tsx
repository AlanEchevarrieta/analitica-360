"use client";

import { useTheme } from "next-themes";
import { Check, Moon, Sun } from "lucide-react";
import { MuestraPaleta } from "@/components/shared/selector-tema";
import { usePaleta } from "@/hooks/use-paleta";
import { PALETAS } from "@/lib/paletas";
import { cn } from "@/lib/utils";

const opcion = (activa: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg p-3 text-left ring-1 transition-colors hover:bg-muted",
    activa ? "ring-2 ring-primary" : "ring-foreground/10",
  );

/** Modo claro/oscuro y paleta de colores. Se guarda en este dispositivo. */
export function AparienciaConfig() {
  const { theme, setTheme } = useTheme();
  const { paleta, setPaleta } = usePaleta();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Modo</span>
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          {[
            { valor: "light", nombre: "Claro", Icono: Sun },
            { valor: "dark", nombre: "Oscuro", Icono: Moon },
          ].map(({ valor, nombre, Icono }) => (
            <button key={valor} type="button" className={opcion(theme === valor)} aria-pressed={theme === valor} onClick={() => setTheme(valor)}>
              <Icono className="size-4" aria-hidden /> {nombre}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Colores</span>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PALETAS.map((p) => (
            <button key={p.clave} type="button" className={opcion(paleta === p.clave)} aria-pressed={paleta === p.clave} onClick={() => setPaleta(p.clave)}>
              <MuestraPaleta colores={p.muestra} />
              <span className="flex-1">
                <span className="block text-sm font-medium">{p.nombre}</span>
                <span className="block text-xs text-muted-foreground">{p.descripcion}</span>
              </span>
              {paleta === p.clave && <Check className="size-4 text-primary" aria-hidden />}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Se guarda en este dispositivo: cada persona del equipo puede elegir el suyo.</p>
    </div>
  );
}
