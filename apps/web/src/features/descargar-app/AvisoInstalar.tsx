"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstalarApp } from "@/hooks/use-instalar-app";
import { PasosInstalacion, type ModoPasos } from "./PasosInstalacion";

const CLAVE_STORAGE = "a360_aviso_instalar_visto";

function leerVistoInicial(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(CLAVE_STORAGE) === "1";
  } catch {
    return false;
  }
}

/**
 * Aviso chico, una sola vez, en Inicio y en el celular:
 * "¿La agregás a tu pantalla de inicio? Abre más rápido".
 */
export function AvisoInstalar() {
  const { dispositivo, puedeInstalarDirecto, instalar } = useInstalarApp();
  const [oculto, setOculto] = useState<boolean>(leerVistoInicial);
  const [modal, setModal] = useState<{ abierto: boolean; modo: ModoPasos }>({
    abierto: false,
    modo: "ios",
  });

  const esCelular = dispositivo.plataforma === "android" || dispositivo.plataforma === "ios";
  if (oculto || dispositivo.instalada || !esCelular) return null;

  const descartar = () => {
    setOculto(true);
    try {
      window.localStorage.setItem(CLAVE_STORAGE, "1");
    } catch {
      // Ignorar si localStorage no está disponible
    }
  };

  const verComo = async () => {
    try {
      window.localStorage.setItem(CLAVE_STORAGE, "1");
    } catch {
      // Ignorar
    }
    if (dispositivo.navegador === "interno") {
      setModal({ abierto: true, modo: "interno" });
      return;
    }
    if (dispositivo.plataforma === "android") {
      if (puedeInstalarDirecto) {
        const r = await instalar();
        if (r === "aceptada") {
          setOculto(true);
          return;
        }
      }
      setModal({ abierto: true, modo: "android" });
      return;
    }
    setModal({ abierto: true, modo: "ios" });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm sm:hidden">
        <div className="flex items-center gap-2.5">
          <Smartphone className="size-4 shrink-0 text-primary" aria-hidden />
          <span>¿La agregás a tu pantalla de inicio? Abre más rápido.</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            className="h-7 px-2.5 text-xs"
            data-rastreo={dispositivo.plataforma === "ios" ? "Descargar app: iPhone" : "Descargar app: Android"}
            onClick={verComo}
          >
            Ver cómo
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={descartar}>
            Ahora no
          </Button>
        </div>
      </div>
      <PasosInstalacion
        abierto={modal.abierto}
        onOpenChange={(abierto) => setModal((m) => ({ ...m, abierto }))}
        modo={modal.modo}
        navegador={dispositivo.navegador}
      />
    </>
  );
}
