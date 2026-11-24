"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatoSegmentoRuta } from "@/lib/navegacion";
import { cn } from "@/lib/utils";

/**
 * Migas de pan automáticas en la barra superior para saber siempre dónde estás
 * y poder retroceder un nivel con un clic.
 */
export function AppBreadcrumbs() {
  const pathname = usePathname();
  const segmentos = pathname.split("/").filter(Boolean);

  if (segmentos.length === 0) return null;

  const items = segmentos.map((seg, i) => ({
    href: "/" + segmentos.slice(0, i + 1).join("/"),
    label: formatoSegmentoRuta(seg, i, segmentos),
    esUltimo: i === segmentos.length - 1,
  }));

  const padre = items.length > 1 ? items[items.length - 2] : null;
  const actual = items[items.length - 1];

  return (
    <>
      {/* Desktop / Tablet: breadcrumb completo */}
      <nav aria-label="Ubicación actual" className="hidden min-w-0 flex-1 items-center gap-1 text-sm sm:flex">
        {items.map((item, idx) => (
          <div key={item.href} className="flex min-w-0 items-center gap-1">
            {idx > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />}
            {item.esUltimo ? (
              <span className="truncate font-medium text-foreground" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Mobile: botón de volver si es subruta + título actual */}
      <div className="flex min-w-0 flex-1 items-center gap-1 text-sm sm:hidden">
        {padre ? (
          <Link
            href={padre.href}
            aria-label={`Volver a ${padre.label}`}
            className={cn(
              "inline-flex items-center gap-0.5 truncate rounded-md px-1 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate font-medium text-foreground">{actual.label}</span>
          </Link>
        ) : (
          <span className="truncate font-medium text-foreground">{actual.label}</span>
        )}
      </div>
    </>
  );
}
