"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PESTANAS = [
  { href: "/inventario", etiqueta: "Stock" },
  { href: "/inventario/movimientos", etiqueta: "Movimientos" },
];

/** Inventario: stock actual o todos los movimientos juntos. */
export function PestanasInventario() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-lg border p-1 w-fit" aria-label="Secciones de inventario">
      {PESTANAS.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={pathname === p.href ? "page" : undefined}
          className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", pathname === p.href ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
        >
          {p.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
