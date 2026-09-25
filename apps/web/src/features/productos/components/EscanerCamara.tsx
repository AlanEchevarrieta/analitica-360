"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Estado = "iniciando" | "escaneando" | "https" | "denegado" | "sin_camara";

const MENSAJES: Record<Exclude<Estado, "iniciando" | "escaneando">, string> = {
  https: "La cámara solo funciona en una conexión segura (https o localhost).",
  denegado: "No hay permiso para usar la cámara. Habilitalo en el candado de la barra de direcciones y reintentá.",
  sin_camara: "No se encontró una cámara en este dispositivo.",
};

/** Mismo código leído dos veces seguidas dentro de esta ventana = una sola lectura. */
const PAUSA_MISMO_CODIGO_MS = 1500;

function conexionSegura() {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || window.location.protocol === "https:";
}

function avisarLectura() {
  try {
    navigator.vibrate?.(60);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => void ctx.close();
  } catch {
    /* sin audio/vibración: la lectura igual se procesa */
  }
}

/**
 * Escáner con la cámara en modo continuo: queda abierto y cada código leído
 * se entrega a `onCodigo` (con pitido y vibración) hasta que se cierra.
 * Puerto de EscanerCodigoBarras del legacy (misma librería zxing).
 */
export function EscanerCamara({ onCodigo, onCerrar }: { onCodigo: (codigo: string) => void; onCerrar: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [estado, setEstado] = useState<Estado>("iniciando");
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const onCodigoRef = useRef(onCodigo);
  useEffect(() => {
    onCodigoRef.current = onCodigo;
  }, [onCodigo]);

  useEffect(() => {
    let vivo = true;
    let detener: (() => void) | null = null;
    const lectura = { codigo: "", hora: 0 };

    void (async () => {
      if (!conexionSegura()) return setEstado("https");
      if (!navigator.mediaDevices?.getUserMedia) return setEstado("sin_camara");
      try {
        const [{ BrowserMultiFormatReader }, zxing] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
          zxing.BarcodeFormat.EAN_13,
          zxing.BarcodeFormat.EAN_8,
          zxing.BarcodeFormat.UPC_A,
          zxing.BarcodeFormat.CODE_128,
          zxing.BarcodeFormat.CODE_39,
          zxing.BarcodeFormat.QR_CODE,
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        if (!videoRef.current || !vivo) return;
        const controles = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current,
          (resultado) => {
            const codigo = resultado?.getText().trim();
            if (!codigo) return;
            const ahora = Date.now();
            if (codigo === lectura.codigo && ahora - lectura.hora < PAUSA_MISMO_CODIGO_MS) return;
            lectura.codigo = codigo;
            lectura.hora = ahora;
            avisarLectura();
            setUltimo(codigo);
            onCodigoRef.current(codigo);
          },
        );
        detener = () => controles.stop();
        if (!vivo) detener();
        else setEstado("escaneando");
      } catch (error) {
        if (!vivo) return;
        const nombre = error instanceof DOMException ? error.name : "";
        setEstado(nombre === "NotAllowedError" || nombre === "PermissionDeniedError" ? "denegado" : "sin_camara");
      }
    })();

    return () => {
      vivo = false;
      detener?.();
    };
  }, [intento]);

  const problema = estado !== "iniciando" && estado !== "escaneando" ? MENSAJES[estado] : null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Camera className="size-4" aria-hidden />
          {estado === "escaneando" ? "Apuntá al código de barras" : estado === "iniciando" ? "Abriendo cámara…" : "Cámara"}
        </span>
        <Button size="icon-sm" variant="ghost" aria-label="Cerrar escáner" onClick={onCerrar}>
          <X />
        </Button>
      </div>
      {problema ? (
        <div className="flex flex-col items-start gap-2 text-sm">
          <p>{problema}</p>
          {estado === "denegado" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEstado("iniciando");
                setIntento((n) => n + 1);
              }}
            >
              Reintentar
            </Button>
          )}
        </div>
      ) : (
        <video ref={videoRef} className="aspect-video w-full rounded-md bg-black object-cover" muted playsInline />
      )}
      {ultimo && <p className="text-xs text-muted-foreground">Último código: {ultimo}</p>}
    </div>
  );
}
