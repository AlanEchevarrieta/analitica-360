"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Un 4xx (sin permiso, no existe, datos inválidos) no se arregla reintentando.
            retry: (intentos, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && intentos < 2,
            // Al volver a una pantalla recién vista se muestra al instante y se actualiza por detrás.
            staleTime: 30_000,
          },
        },
      }),
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Recuperación automática ante nuevos despliegues: si un chunk viejo ya no existe en el servidor,
    // se fuerza una recarga limpia para cargar los bundles de la versión actualizada.
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const error = "reason" in event ? event.reason : event.error;
      const message = error?.message || "";
      if (
        message.includes("ChunkLoadError") ||
        message.includes("Failed to load chunk") ||
        message.includes("Failed to fetch dynamically imported module")
      ) {
        const clave = "a360_ultimo_chunk_reload";
        const ultimo = sessionStorage.getItem(clave);
        const ahora = Date.now();
        if (!ultimo || ahora - Number(ultimo) > 10_000) {
          sessionStorage.setItem(clave, String(ahora));
          window.location.reload();
        }
      }
    };
    window.addEventListener("error", handleChunkError);
    window.addEventListener("unhandledrejection", handleChunkError);

    // Registro y actualización forzada del Service Worker PWA
    if ("serviceWorker" in navigator) {
      const registrar = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            void reg.update();
          })
          .catch((err) => {
            console.debug("PWA service worker:", err);
          });
      };
      if (document.readyState === "complete") {
        registrar();
      } else {
        window.addEventListener("load", registrar, { once: true });
      }
    }

    return () => {
      window.removeEventListener("error", handleChunkError);
      window.removeEventListener("unhandledrejection", handleChunkError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange nonce={nonce}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
