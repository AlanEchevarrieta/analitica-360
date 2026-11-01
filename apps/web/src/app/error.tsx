"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Home, RefreshCw } from "lucide-react";
import { Logo } from "@/features/sitio/components/Logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Registro del error en consola para diagnóstico
    console.error("Error capturado por Analítica 360 ErrorBoundary:", error);
  }, [error]);

  const recargar = () => {
    try {
      reset();
    } catch {
      window.location.reload();
    }
  };

  const volverAtras = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/inicio";
    }
  };

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center animate-in fade-in-50 duration-300">
      <div className="relative flex w-full max-w-lg flex-col items-center rounded-2xl border border-border/60 bg-card/60 p-8 shadow-2xl backdrop-blur-md sm:p-10">
        {/* Resplandor ambiental de fondo */}
        <div
          className="pointer-events-none absolute -top-20 size-48 rounded-full bg-cyan-500/15 blur-3xl"
          aria-hidden="true"
        />

        {/* Logo oficial de Analítica 360 */}
        <div className="mb-6">
          <Logo className="scale-110" />
        </div>

        {/* Mensaje principal solicitado */}
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Ocurrió un error, estamos trabajando para resolverlo
        </h1>

        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Se produjo una interrupción inesperada al cargar esta sección. Tus datos y operaciones se encuentran a salvo.
        </p>

        {/* Botones de acción principales */}
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={recargar} className="w-full sm:w-auto gap-2">
            <RefreshCw className="size-4" /> Recargar página
          </Button>

          <Button variant="outline" onClick={volverAtras} className="w-full sm:w-auto gap-2">
            <ArrowLeft className="size-4" /> Volver atrás
          </Button>

          <Link href="/inicio" className={cn(buttonVariants({ variant: "ghost" }), "w-full sm:w-auto gap-2")}>
            <Home className="size-4" /> Inicio
          </Link>
        </div>

        {/* Detalle técnico colapsable para soporte */}
        {error?.message && (
          <details className="mt-6 w-full rounded-lg border border-border/40 bg-muted/30 p-3 text-left text-xs text-muted-foreground transition-all">
            <summary className="cursor-pointer font-medium select-none hover:text-foreground">
              Detalle del error (para soporte técnico)
            </summary>
            <div className="mt-2 max-h-36 overflow-y-auto rounded bg-background/80 p-2 font-mono text-[11px] text-destructive/90">
              <p>{error.message}</p>
              {error.digest && <p className="mt-1 text-muted-foreground">ID de error: {error.digest}</p>}
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
