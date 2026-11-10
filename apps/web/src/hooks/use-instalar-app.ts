"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { detectarDispositivo, type Dispositivo } from "@/lib/dispositivo";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISPOSITIVO_INICIAL: Dispositivo = {
  plataforma: "compu",
  navegador: "otro",
  instalada: false,
};

function leerDispositivoCliente(): Dispositivo {
  if (typeof window === "undefined") return DISPOSITIVO_INICIAL;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return detectarDispositivo(
    window.navigator.userAgent ?? "",
    window.navigator.maxTouchPoints ?? 0,
    standalone,
  );
}

/**
 * Detecta el dispositivo en el navegador y escucha `beforeinstallprompt` y `appinstalled`.
 */
export function useInstalarApp() {
  const [dispositivo, setDispositivo] = useState<Dispositivo>(leerDispositivoCliente);
  const [eventoInstalacion, setEventoInstalacion] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEventoInstalacion(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setEventoInstalacion(null);
      setDispositivo((prev) => ({ ...prev, instalada: true }));
      toast.success("¡Listo! Ya la tenés en tu pantalla de inicio.");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const instalar = useCallback(async (): Promise<"aceptada" | "rechazada" | "sin_evento"> => {
    if (!eventoInstalacion) return "sin_evento";
    try {
      await eventoInstalacion.prompt();
      const { outcome } = await eventoInstalacion.userChoice;
      setEventoInstalacion(null);
      if (outcome === "accepted") {
        setDispositivo((prev) => ({ ...prev, instalada: true }));
        toast.success("¡Listo! Ya la tenés en tu pantalla de inicio.");
        return "aceptada";
      }
      return "rechazada";
    } catch {
      return "sin_evento";
    }
  }, [eventoInstalacion]);

  return {
    dispositivo,
    puedeInstalarDirecto: Boolean(eventoInstalacion),
    instalar,
  };
}
