"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { ApiError } from "@/lib/api-client";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/** Observa el estado de sesión de Clerk: si el usuario pierde la sesión o limpia storage en una ruta privada, redirige al login. */
function ObservadorSesion() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;
    const esPublica =
      pathname === "/" ||
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up") ||
      pathname.startsWith("/terminos") ||
      pathname.startsWith("/privacidad") ||
      pathname.startsWith("/ticket") ||
      pathname.startsWith("/guias");

    if (!isSignedIn && !esPublica) {
      const destino = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/sign-in?redirect_url=${destino}`;
    }
  }, [isLoaded, isSignedIn, pathname]);

  return null;
}

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

    // Limpieza activa de cualquier Service Worker previo para evitar bloqueos de red
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          void reg.unregister();
        }
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            void caches.delete(key);
          }
        });
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
          <ObservadorSesion />
          {children}
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
