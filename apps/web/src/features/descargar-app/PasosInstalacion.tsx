"use client";

import { ArrowDown, ArrowUp, Copy, EllipsisVertical, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Navegador } from "@/lib/dispositivo";
import { QrDescarga } from "./QrDescarga";

export type ModoPasos = "ios" | "android" | "mac" | "interno" | "qr";

export function PasosInstalacion({
  abierto,
  onOpenChange,
  modo,
  navegador = "safari",
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  modo: ModoPasos;
  navegador?: Navegador;
}) {
  const copiarLink = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "https://analitica360.app";
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado. Pegalo en Safari o Chrome.");
    } catch {
      toast.error("No se pudo copiar el link.");
    }
  };

  const compartirArriba = navegador === "chrome" || navegador === "edge";

  return (
    <Sheet open={abierto} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl p-6">
        <SheetHeader className="p-0">
          <SheetTitle className="text-lg">
            {modo === "ios" && "Agregar Analítica 360 a tu iPhone o iPad"}
            {modo === "android" && "Instalar Analítica 360 en tu Android"}
            {modo === "mac" && "Agregar Analítica 360 al Dock en Mac"}
            {modo === "interno" && "Abrí esta página en tu navegador"}
            {modo === "qr" && "Usala en tu celular"}
          </SheetTitle>
          <SheetDescription>
            {modo === "ios" && "Seguí estos 3 pasos desde Safari o Chrome. No ocupa espacio y abre a pantalla completa."}
            {modo === "android" && "Agregala a tu pantalla de inicio en segundos."}
            {modo === "mac" && "Desde Safari en Mac podés dejarla fija en tu Dock."}
            {modo === "interno" && "Estás adentro de Instagram, WhatsApp o Facebook, que no permiten instalar apps directo."}
            {modo === "qr" && "Escaneá el código con la cámara de tu teléfono para instalarla."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-3 text-sm">
          {modo === "ios" && (
            <>
              <ol className="flex flex-col gap-3">
                <li className="flex items-start gap-3 rounded-xl border p-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Share className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium">
                      1. Tocá el botón <b>Compartir</b>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {compartirArriba
                        ? "Está arriba a la derecha, en la barra de direcciones."
                        : "Es el cuadrado con la flecha hacia arriba, en la barra de Safari."}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-xl border p-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <SquarePlus className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium">
                      2. Elegí <b>«Agregar a inicio»</b>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Deslizá el menú hacia abajo hasta encontrar la opción con el signo más.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-xl border p-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                    3
                  </span>
                  <div>
                    <p className="font-medium">
                      3. Tocá <b>«Agregar»</b> arriba a la derecha
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ¡Listo! Ya tenés el ícono de Analítica 360 en tu pantalla de inicio.
                    </p>
                  </div>
                </li>
              </ol>
              <div className="flex items-center justify-center gap-2 pt-1 text-xs font-medium text-primary">
                {compartirArriba ? (
                  <>
                    <ArrowUp className="size-4 animate-bounce" aria-hidden /> Buscá el botón Compartir arriba a la derecha
                  </>
                ) : (
                  <>
                    <ArrowDown className="size-4 animate-bounce" aria-hidden /> Buscá el botón Compartir acá abajo en Safari
                  </>
                )}
              </div>
            </>
          )}

          {modo === "android" && (
            <ol className="flex flex-col gap-3">
              <li className="flex items-start gap-3 rounded-xl border p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <EllipsisVertical className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="font-medium">
                    1. Tocá el menú <b>⋮</b> del navegador
                  </p>
                  <p className="text-xs text-muted-foreground">Está arriba a la derecha en Chrome o abajo en Samsung Internet.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl border p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <SquarePlus className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="font-medium">
                    2. Tocá <b>«Instalar aplicación»</b> o <b>«Agregar a pantalla de inicio»</b>
                  </p>
                  <p className="text-xs text-muted-foreground">Confirmá y el ícono queda en tu celular como cualquier otra app.</p>
                </div>
              </li>
            </ol>
          )}

          {modo === "mac" && (
            <ol className="flex flex-col gap-3">
              <li className="flex items-start gap-3 rounded-xl border p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                  1
                </span>
                <div>
                  <p className="font-medium">
                    En la barra superior de Safari, abrí <b>Archivo</b> → <b>«Agregar al Dock…»</b>
                  </p>
                  <p className="text-xs text-muted-foreground">También podés tocar el botón Compartir y elegir «Agregar al Dock».</p>
                </div>
              </li>
            </ol>
          )}

          {modo === "interno" && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border p-3">
                <p className="font-medium">
                  1. Tocá los tres puntos <b>⋯</b> arriba a la derecha y elegí <b>«Abrir en el navegador»</b> (Safari o Chrome).
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  O copiá el link acá abajo y pegalo directo en Safari o Chrome:
                </p>
              </div>
              <Button type="button" onClick={copiarLink} data-rastreo="Descargar app: copiar link">
                <Copy className="mr-1.5 size-4" aria-hidden /> Copiar link
              </Button>
            </div>
          )}

          {modo === "qr" && (
            <div className="flex flex-col items-center gap-3 py-2">
              <QrDescarga />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
