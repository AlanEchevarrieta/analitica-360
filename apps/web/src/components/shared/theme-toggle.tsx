"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Puerto de ThemeToggle (legacy src/lib/tema.ts) - solo oscuro/claro, sin modo "system" (mismo criterio que el legacy). */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [montado, setMontado] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flag de "ya hidrató" para evitar el mismatch SSR/cliente del ícono según el tema; no hay valor externo que sincronizar, es el patrón recomendado por next-themes.
    setMontado(true);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Cambiar tema"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {montado && theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
