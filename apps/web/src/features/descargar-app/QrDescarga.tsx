"use client";

import { APP_DESCARGA } from "@/features/sitio/contenido";

/** Código QR estático (SVG local, sin servicios externos) que apunta a https://analitica360.app/?descargar=1. */
export function QrDescarga({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="inline-flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/qr-app.svg"
          alt={`Código QR para abrir ${APP_DESCARGA.urlQr} en tu celular`}
          width={168}
          height={168}
          className="size-42 rounded-lg"
        />
        <span className="text-center text-xs font-medium text-slate-600">
          Escanealo con la cámara de tu celular
        </span>
      </div>
    </div>
  );
}
