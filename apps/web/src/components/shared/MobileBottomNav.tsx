"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Landmark, Menu, Package, PlusCircle } from "lucide-react";
import { calcularModulosEfectivos } from "@analitica360/shared-types";
import { useSidebar } from "@/components/ui/sidebar";
import { useConfiguracion } from "@/features/configuracion/hooks/use-configuracion";
import { useAcceso } from "@/hooks/use-acceso";
import { usePlan } from "@/hooks/use-plan";
import { ACTIVIDADES_POR_DEFECTO } from "@/lib/rubros";
import { cn } from "@/lib/utils";

/**
 * Barra de navegación inferior para celulares (< 768px) con los flujos diarios
 * más frecuentes y acceso al menú completo.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { puede } = useAcceso();
  const plan = usePlan();
  const configData = useConfiguracion().data;
  const actividades = configData?.actividades ?? ACTIVIDADES_POR_DEFECTO;
  const modulosEfectivos =
    configData?.modulosEfectivos ?? calcularModulosEfectivos(actividades, configData?.modulos);

  const activo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const soloServicios = actividades.includes("servicios") && !actividades.includes("productos") && !actividades.includes("produccion");
  const mostrarAgenda = soloServicios && modulosEfectivos.agenda !== false && plan.incluye("agenda");

  const accesos = [
    puede("inicio") ? { href: "/inicio", label: "Inicio", icon: Home, destacado: false } : null,
    puede("ventas") ? { href: "/ventas/nueva", label: "Vender", icon: PlusCircle, destacado: true } : null,
    mostrarAgenda
      ? { href: "/agenda", label: "Agenda", icon: CalendarDays, destacado: false }
      : puede("ventas") && modulosEfectivos.caja !== false
        ? { href: "/caja", label: "Caja", icon: Landmark, destacado: false }
        : null,
    puede("productos") ? { href: "/productos", label: "Catálogo", icon: Package, destacado: false } : null,
  ].filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <nav
      aria-label="Accesos rápidos móviles"
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-card/95 px-2 backdrop-blur-md md:hidden print:hidden"
    >
      {accesos.map((item) => {
        const Icono = item.icon;
        const esActivo = activo(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={esActivo ? "page" : undefined}
            className={cn(
              "flex min-w-14 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors",
              item.destacado
                ? "text-primary"
                : esActivo
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full transition-colors",
                item.destacado && "bg-primary text-primary-foreground shadow-xs",
                !item.destacado && esActivo && "bg-accent text-accent-foreground",
              )}
            >
              <Icono className="size-4" aria-hidden />
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        aria-label="Abrir menú completo"
        className="flex min-w-14 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
      >
        <span className="flex size-7 items-center justify-center rounded-full">
          <Menu className="size-4" aria-hidden />
        </span>
        <span>Menú</span>
      </button>
    </nav>
  );
}
