"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Palette, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePaleta } from "@/hooks/use-paleta";
import { PALETAS, esPaleta } from "@/lib/paletas";
import { cn } from "@/lib/utils";

/** Tres puntitos con los colores principales de una paleta. */
export function MuestraPaleta({ colores, className }: { colores: readonly string[]; className?: string }) {
  return (
    <span className={cn("flex -space-x-1", className)} aria-hidden>
      {colores.map((c) => (
        <span key={c} className="size-3.5 rounded-full ring-2 ring-popover" style={{ background: c }} />
      ))}
    </span>
  );
}

/** Menú de apariencia del sidebar: modo claro/oscuro + paleta de colores. */
export function SelectorTema() {
  const { theme, setTheme } = useTheme();
  const { paleta, setPaleta } = usePaleta();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Cambiar tema y colores" />}>
        <Palette />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Modo</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "dark"} onValueChange={(v) => setTheme(String(v))}>
            <DropdownMenuRadioItem value="light" closeOnClick={false}>
              <Sun /> Claro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" closeOnClick={false}>
              <Moon /> Oscuro
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Colores</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={paleta} onValueChange={(v) => esPaleta(v) && setPaleta(v)}>
            {PALETAS.map((p) => (
              <DropdownMenuRadioItem key={p.clave} value={p.clave} closeOnClick={false}>
                <MuestraPaleta colores={p.muestra} />
                {p.nombre}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
