"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Compass, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  haVistoTour,
  iniciarTourAnalitica360,
  iniciarTourModulo,
  TOURS_MODULOS,
} from "@/lib/tour";

export function BotonTour() {
  const [montado, setMontado] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Detectar qué módulo corresponde según el pathname actual
  const detectarModuloActual = (): string => {
    if (!pathname) return "general";
    if (pathname.startsWith("/ventas")) return "ventas";
    if (pathname.startsWith("/clientes")) return "clientes";
    if (pathname.startsWith("/pedidos")) return "pedidos";
    if (pathname.startsWith("/productos")) return "productos";
    if (pathname.startsWith("/inventario")) return "inventario";
    if (pathname.startsWith("/compras") || pathname.startsWith("/proveedores")) return "compras";
    if (pathname.startsWith("/analytics") || pathname.startsWith("/objetivos")) return "analytics";
    if (pathname.startsWith("/ia")) return "copilot";
    if (pathname.startsWith("/agenda")) return "agenda";
    if (pathname.startsWith("/abonos")) return "abonos";
    if (pathname.startsWith("/ordenes-trabajo")) return "ordenes";
    if (pathname.startsWith("/produccion")) return "produccion";
    if (pathname.startsWith("/configuracion")) return "configuracion";
    return "general";
  };

  const moduloActual = detectarModuloActual();
  const defModulo = TOURS_MODULOS[moduloActual];

  useEffect(() => {
    setMontado(true);

    // Si viene ?tour=1 o ?tour=<modulo> en la URL, ejecutamos el tour automáticamente
    const tourParam = searchParams.get("tour");
    if (tourParam) {
      const timer = setTimeout(() => {
        const idTour = tourParam === "1" ? moduloActual : tourParam;
        iniciarTourModulo(idTour);
      }, 500);
      return () => clearTimeout(timer);
    }

    // Si es un usuario nuevo y está en el inicio, sugerir tour general tras 1 segundo
    if (!haVistoTour() && (pathname === "/inicio" || pathname === "/")) {
      const timer = setTimeout(() => {
        iniciarTourAnalitica360(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams, moduloActual]);

  if (!montado) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => {
      iniciarTourModulo(moduloActual);
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      title={`Iniciar tour guiado de ${defModulo ? defModulo.nombre : "la plataforma"}`}
      className="gap-1.5 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400 font-medium text-xs transition-colors shadow-xs cursor-pointer"
    >
      <Sparkles className="size-3.5 text-emerald-400" />
      <span className="hidden sm:inline">
        {moduloActual === "general" ? "Tour interactivo" : `Paso a paso (${defModulo?.nombre.split(" ")[0]})`}
      </span>
      <span className="sm:hidden">Tour</span>
    </Button>
  );
}
