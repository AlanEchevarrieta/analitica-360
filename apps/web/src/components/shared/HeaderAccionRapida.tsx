"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useAcceso } from "@/hooks/use-acceso";

/**
 * Acción rápida primaria del header: solo visible si el usuario tiene permiso en Ventas.
 */
export function HeaderAccionRapida() {
  const { puede, cargado } = useAcceso();
  if (!cargado || !puede("ventas")) return null;

  return (
    <Link
      href="/ventas/nueva"
      className="hidden lg:inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus className="size-3.5" aria-hidden />
      <span>Nueva venta</span>
    </Link>
  );
}
