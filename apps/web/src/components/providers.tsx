"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import {
  ApiError,
  EVENTO_SESION_EXPIRADA,
  esRutaPublica,
  obtenerTokenFresco,
  registrarRefrescadorSesion,
} from "@/lib/api-client";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/**
 * Observa y mantiene viva la sesión de Clerk:
 * 1) Registra el refrescador global (`getToken({ skipCache: true })`) para `apiFetch` y `apiArchivo`.
 * 2) Al volver a la pestaña (`visibilitychange`) o recuperar conexión (`online`), renueva el JWT en segundo plano.
 * 3) Escucha `EVENTO_SESION_EXPIRADA` y valida si la sesión realmente se cerró antes de redirigir al login.
 */
function ObservadorSesion() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const pathname = usePathname();
  const redirigiendoRef = React.useRef(false);

  const redirigirLogin = React.useCallback(() => {
    if (typeof window === "undefined" || redirigiendoRef.current) return;
    if (esRutaPublica(window.location.pathname)) return;
    redirigiendoRef.current = true;
    const destino = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/sign-in?redirect_url=${destino}`;
  }, []);

  React.useEffect(() => {
    registrarRefrescadorSesion(() => getToken({ skipCache: true }));
    return () => registrarRefrescadorSesion(null);
  }, [getToken]);

  React.useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;
    if (!isSignedIn && !esRutaPublica(pathname)) {
      redirigirLogin();
    }
  }, [isLoaded, isSignedIn, pathname, redirigirLogin]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const alExpirarSesion = async () => {
      if (navigator.onLine === false || esRutaPublica(window.location.pathname)) return;
      // Última verificación sin caché: si Clerk sigue entregando un token válido, no desconectamos al usuario.
      const token = await obtenerTokenFresco();
      if (!token) {
        redirigirLogin();
      }
    };

    const alRecuperarFocoORed = () => {
      if (document.visibilityState === "visible" && isSignedIn && navigator.onLine !== false) {
        void obtenerTokenFresco();
      }
    };

    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirarSesion);
    document.addEventListener("visibilitychange", alRecuperarFocoORed);
    window.addEventListener("online", alRecuperarFocoORed);

    return () => {
      window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirarSesion);
      document.removeEventListener("visibilitychange", alRecuperarFocoORed);
      window.removeEventListener("online", alRecuperarFocoORed);
    };
  }, [isSignedIn, redirigirLogin]);

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
