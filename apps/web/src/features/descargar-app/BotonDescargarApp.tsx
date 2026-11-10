"use client";

import { useEffect, useState } from "react";
import { Laptop, QrCode, Smartphone } from "lucide-react";
import { useInstalarApp } from "@/hooks/use-instalar-app";
import { cn } from "@/lib/utils";
import { PasosInstalacion, type ModoPasos } from "./PasosInstalacion";

/**
 * Botón inteligente de descarga según el dispositivo detectado + "¿Otro dispositivo?"
 * para ver Android, iPhone o QR de compu en cualquier momento.
 */
export function BotonDescargarApp({ className }: { className?: string }) {
  const { dispositivo, puedeInstalarDirecto, instalar } = useInstalarApp();
  const [modal, setModal] = useState<{ abierto: boolean; modo: ModoPasos }>({
    abierto: false,
    modo: "ios",
  });
  const [verOtros, setVerOtros] = useState(false);

  // Si entran desde el QR (?descargar=1), bajar automáticamente hasta la sección #app.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("descargar") === "1") {
      document.getElementById("app")?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  if (dispositivo.instalada) return null;

  const abrirModo = (modo: ModoPasos) => setModal({ abierto: true, modo });

  const accionPrincipal = async () => {
    if (dispositivo.navegador === "interno") {
      abrirModo("interno");
      return;
    }
    if (dispositivo.plataforma === "android") {
      if (puedeInstalarDirecto) {
        const r = await instalar();
        if (r === "sin_evento") abrirModo("android");
      } else {
        abrirModo("android");
      }
      return;
    }
    if (dispositivo.plataforma === "ios") {
      abrirModo("ios");
      return;
    }
    if (puedeInstalarDirecto) {
      const r = await instalar();
      if (r === "sin_evento") abrirModo("qr");
      return;
    }
    if (dispositivo.plataforma === "mac" && dispositivo.navegador === "safari") {
      abrirModo("mac");
      return;
    }
    abrirModo("qr");
  };

  let textoBoton = "📱 Usala en tu celular";
  let rastreo = "Descargar app: QR";
  if (dispositivo.navegador === "interno") {
    textoBoton =
      dispositivo.plataforma === "ios"
        ? "Abrí esta página en Safari para instalarla"
        : "Abrí esta página en Chrome para instalarla";
    rastreo = "Descargar app: navegador interno";
  } else if (dispositivo.plataforma === "android") {
    textoBoton = "📲 Instalar en tu Android";
    rastreo = "Descargar app: Android";
  } else if (dispositivo.plataforma === "ios") {
    textoBoton = "📲 Agregar a tu iPhone";
    rastreo = "Descargar app: iPhone";
  } else if (puedeInstalarDirecto) {
    textoBoton = "💻 Instalar en la compu";
    rastreo = "Descargar app: compu";
  } else if (dispositivo.plataforma === "mac" && dispositivo.navegador === "safari") {
    textoBoton = "💻 Agregar al Dock";
    rastreo = "Descargar app: Mac Dock";
  }

  return (
    <div className={cn("flex flex-col items-start gap-2.5", className)}>
      <button
        type="button"
        onClick={accionPrincipal}
        data-rastreo={rastreo}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition-colors hover:bg-indigo-700"
      >
        {textoBoton}
      </button>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <button
          type="button"
          onClick={() => setVerOtros((v) => !v)}
          className="font-medium underline underline-offset-2 hover:text-slate-900"
        >
          ¿Otro dispositivo?
        </button>
        {verOtros && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-rastreo="Descargar app: Android"
              onClick={async () => {
                if (dispositivo.plataforma === "android" && puedeInstalarDirecto) {
                  await instalar();
                } else {
                  abrirModo("android");
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
            >
              <Smartphone className="size-3.5" aria-hidden /> Android
            </button>
            <button
              type="button"
              data-rastreo="Descargar app: iPhone"
              onClick={() => abrirModo("ios")}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
            >
              <Smartphone className="size-3.5" aria-hidden /> iPhone / iPad
            </button>
            <button
              type="button"
              data-rastreo="Descargar app: QR"
              onClick={async () => {
                if (puedeInstalarDirecto && dispositivo.plataforma !== "android") {
                  await instalar();
                } else {
                  abrirModo("qr");
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
            >
              {puedeInstalarDirecto ? <Laptop className="size-3.5" aria-hidden /> : <QrCode className="size-3.5" aria-hidden />} Compu / QR
            </button>
          </div>
        )}
      </div>

      <PasosInstalacion
        abierto={modal.abierto}
        onOpenChange={(abierto) => setModal((m) => ({ ...m, abierto }))}
        modo={modal.modo}
        navegador={dispositivo.navegador}
      />
    </div>
  );
}
