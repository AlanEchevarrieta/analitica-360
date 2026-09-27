"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useAcceso } from "@/hooks/use-acceso";
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

/** Aplica RequiereModulo según la dirección actual (va una vez, en el marco del panel). */
export function GuardaDeRuta({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const modulo = MODULO_DE_RUTA.find(([prefijo]) => pathname === prefijo || pathname.startsWith(`${prefijo}/`))?.[1];
  return modulo ? <RequiereModulo modulo={modulo}>{children}</RequiereModulo> : children;
}
