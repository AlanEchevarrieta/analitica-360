"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/analytics/ventas", etiqueta: "Ventas" },
  { href: "/analytics/productos", etiqueta: "Ganancia por producto" },
  { href: "/analytics/contabilidad", etiqueta: "Contabilidad" },
  { href: "/analytics/insights", etiqueta: "Insights" },
];

export function AnalyticsTabs() {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  // En celular las pestañas no entran: mostrar siempre la activa.
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    <nav ref={nav} className="flex gap-1 overflow-x-auto border-b" aria-label="Secciones de Analytics">
      {TABS.map((t) => {
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
