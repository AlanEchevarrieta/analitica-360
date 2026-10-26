"use client";

import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haVistoTour, iniciarTourAnalitica360 } from "@/lib/tour";

export function BotonTour() {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);

    // Si es un usuario nuevo o nunca vio el tour, lo iniciamos de forma amigable tras 1 segundo
    if (!haVistoTour()) {
      const timer = setTimeout(() => {
        iniciarTourAnalitica360(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!montado) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => iniciarTourAnalitica360(true)}
      title="Iniciar tour interactivo de Analítica 360"
      className="gap-1.5 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400 font-medium text-xs transition-colors shadow-sm"
    >
      <Compass className="size-3.5 text-emerald-400 animate-spin-slow" />
      <span className="hidden sm:inline">Guía rápida</span>
    </Button>
  );
}
