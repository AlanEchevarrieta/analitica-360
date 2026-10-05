"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useAcceso } from "@/hooks/use-acceso";
import { usePlan } from "@/hooks/use-plan";
import { MejorarPlan } from "@/components/shared/mejorar-plan";
import type { ModuloClave } from "@/lib/rol";

/** Pantalla de un módulo: si el usuario no lo tiene habilitado, un aviso claro en vez de errores. */
export function RequiereModulo({ modulo, children }: { modulo: ModuloClave; children: ReactNode }) {
  const { puede, cargado } = useAcceso();
  if (!cargado) return null;
  if (!puede(modulo)) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl p-10 text-center ring-1 ring-foreground/10">
        <Lock className="size-6 text-muted-foreground" aria-hidden />
        <p className="font-medium">Esta sección no está habilitada para tu usuario</p>
        <p className="text-sm text-muted-foreground">Si la necesitás, pedile al dueño de la cuenta que te dé acceso desde Configuración → Equipo.</p>
      </div>
    );
  }
  return children;
}

/** Qué módulo necesita cada sección (el más específico primero). */
const MODULO_DE_RUTA: [string, ModuloClave][] = [
  ["/analytics/contabilidad", "contabilidad"],
  ["/analytics/estados", "contabilidad"],
  ["/analytics/libro", "contabilidad"],
  ["/analytics/insights", "insights"],
  ["/analytics", "analytics"],
  ["/ventas", "ventas"],
  ["/productos", "productos"],
  ["/clientes", "clientes"],
  ["/compras", "compras"],
  ["/pedidos", "pedidos"],
  ["/proveedores", "proveedores"],
  ["/inventario", "inventario"],
  ["/produccion", "produccion"],
  ["/configuracion", "configuracion"],
];

/** Secciones que dependen de una función del plan que no es un módulo entero (el más específico primero). */
const FUNCION_DE_RUTA: [string, string][] = [
  ["/clientes/segmentos", "difusiones"],
  ["/clientes/cuenta-corriente", "cuenta_corriente"],
  ["/productos/importar", "importar"],
];

const coincide = (pathname: string, prefijo: string) => pathname === prefijo || pathname.startsWith(`${prefijo}/`);

/** Aplica el plan (candado + mejorar) y después RequiereModulo según la dirección actual (va una vez, en el marco del panel). */
export function GuardaDeRuta({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { incluye } = usePlan();
  const modulo = MODULO_DE_RUTA.find(([prefijo]) => coincide(pathname, prefijo))?.[1];
  const funcion = FUNCION_DE_RUTA.find(([prefijo]) => coincide(pathname, prefijo))?.[1] ?? (modulo !== "configuracion" ? modulo : undefined);
  if (funcion && !incluye(funcion)) return <MejorarPlan funcion={funcion} />;
  return modulo ? <RequiereModulo modulo={modulo}>{children}</RequiereModulo> : children;
}
