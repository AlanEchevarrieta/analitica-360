"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { ArrowLeft, Home, RefreshCw } from "lucide-react";
import { Logo } from "@/features/sitio/components/Logo";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Error global de aplicación capturado:", error);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
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
    <html lang="es" className="dark h-full">
      <body className="min-h-full flex flex-col items-center justify-center bg-[#080C14] text-[#F1F5F9] p-6 antialiased font-sans">
        <div className="relative flex w-full max-w-lg flex-col items-center rounded-2xl border border-slate-800 bg-[#0F172A]/80 p-8 shadow-2xl backdrop-blur-md text-center sm:p-10">
          {/* Logo oficial de Analítica 360 */}
          <div className="mb-6">
            <Logo className="scale-110" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Ocurrió un error, estamos trabajando para resolverlo
          </h1>

          <p className="mt-3 text-sm text-slate-400 sm:text-base">
            Se produjo una interrupción inesperada al cargar la aplicación. Tus datos y operaciones se encuentran a salvo.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={recargar}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 active:scale-95"
            >
              <RefreshCw className="size-4" /> Recargar página
            </button>

            <button
              onClick={volverAtras}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-95"
            >
              <ArrowLeft className="size-4" /> Volver atrás
            </button>

            <a
              href="/inicio"
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-400 transition hover:text-white"
            >
              <Home className="size-4" /> Inicio
            </a>
          </div>

          {error?.message && (
            <details className="mt-6 w-full rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-left text-xs text-slate-400">
              <summary className="cursor-pointer font-medium hover:text-slate-200 select-none">
                Detalle del error (para soporte técnico)
              </summary>
              <div className="mt-2 max-h-36 overflow-y-auto rounded bg-black/40 p-2 font-mono text-[11px] text-red-400">
                <p>{error.message}</p>
                {error.digest && <p className="mt-1 text-slate-500">ID de error: {error.digest}</p>}
              </div>
            </details>
          )}
        </div>
      </body>
    </html>
  );
}
