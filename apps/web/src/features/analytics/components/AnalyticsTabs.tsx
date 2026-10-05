"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAcceso } from "@/hooks/use-acceso";
import type { ModuloClave } from "@/lib/rol";
import { SelectorMoneda } from "@/components/shared/selector-moneda";

/** Secciones que se ven solo en pesos: los balances y el libro no cierran si cada línea va con otra cotización; Insights mezcla precios de hoy e históricos. */
const SOLO_PESOS = ["/analytics/estados", "/analytics/libro", "/analytics/insights"];

/** Título de Analytics con el botón $ / US$. */
export function EncabezadoAnalytics() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold">Analytics</h1>
      <SelectorMoneda soloPesos={SOLO_PESOS.some((r) => pathname.startsWith(r))} />
    </div>
  );
}

const TABS: { href: string; etiqueta: string; modulo?: ModuloClave }[] = [
  { href: "/analytics/ventas", etiqueta: "Ventas" },
  { href: "/analytics/productos", etiqueta: "Ganancia por producto" },
  { href: "/analytics/contabilidad", etiqueta: "Contabilidad", modulo: "contabilidad" },
  { href: "/analytics/estados", etiqueta: "Estados contables", modulo: "contabilidad" },
  { href: "/analytics/libro", etiqueta: "Libro diario", modulo: "contabilidad" },
  { href: "/analytics/insights", etiqueta: "Insights", modulo: "insights" },
];

export function AnalyticsTabs() {
  const pathname = usePathname();
  const { puede } = useAcceso();
  const nav = useRef<HTMLElement>(null);
  // En celular las pestañas no entran: mostrar siempre la activa.
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    <nav ref={nav} className="flex gap-1 overflow-x-auto border-b" aria-label="Secciones de Analytics">
      {TABS.filter((t) => !t.modulo || puede(t.modulo)).map((t) => {
        const activo = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activo ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors ${
              activo ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
