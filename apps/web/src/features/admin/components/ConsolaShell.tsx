"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useEsAdmin, useTicketsAdmin } from "../hooks/use-admin";

const SECCIONES = [
  { href: "/admin", etiqueta: "Resumen" },
  { href: "/admin/clientes", etiqueta: "Clientes" },
  { href: "/admin/pagos", etiqueta: "Pagos" },
  { href: "/admin/soporte", etiqueta: "Soporte" },
  { href: "/admin/sistema", etiqueta: "Sistema" },
];

function Navegacion() {
  const pathname = usePathname();
  const tickets = useTicketsAdmin();
  const abiertos = (tickets.data ?? []).filter((t) => t.estado === "abierto").length;
  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label="Secciones de la consola">
      {SECCIONES.map((s) => {
        const activo = s.href === "/admin" ? pathname === "/admin" : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
              activo ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {s.etiqueta}
            {s.href === "/admin/soporte" && abiertos > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground tabular-nums">{abiertos}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Marco de la consola del dueño del producto: identidad propia y acceso solo para administradores. */
export function ConsolaShell({ children }: { children: ReactNode }) {
  const acceso = useEsAdmin();
  const esAdmin = acceso.data?.admin === true;

  return (
    <div className="consola dark min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground">A</span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">Consola</span>
              <span className="block text-[11px] text-muted-foreground">Analítica 360 · uso interno</span>
            </span>
          </Link>
          {esAdmin && (
            <div className="order-3 w-full md:order-none md:ml-6 md:w-auto">
              <Navegacion />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Link href="/inicio" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <ArrowLeft aria-hidden /> Volver a la app
            </Link>
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6">
        {acceso.isPending ? (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : !esAdmin ? (
          <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
            <ShieldAlert className="size-10 text-muted-foreground" aria-hidden />
            <h1 className="text-lg font-semibold">Esta consola es solo para el equipo de Analítica 360</h1>
            <p className="text-sm text-muted-foreground">Tu usuario no tiene permiso de administrador de la aplicación.</p>
            <Link href="/inicio" className={buttonVariants()}>
              Volver a la app
            </Link>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
