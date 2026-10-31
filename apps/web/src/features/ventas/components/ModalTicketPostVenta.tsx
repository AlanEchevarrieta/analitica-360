"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, MessageCircle, Printer, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTicket } from "@/features/documentos/use-documentos";
import { TicketTermico } from "./TicketTermico";
import { linkWhatsApp } from "@/features/clientes/hooks/use-clientes";

interface Props {
  ventaId: string | null;
  onCerrar: () => void;
}

export function ModalTicketPostVenta({ ventaId, onCerrar }: Props) {
  const { data: ticket, isPending } = useTicket("venta", ventaId);
  const [telefonoExtra, setTelefonoExtra] = useState("");

  // Atajo de teclado: Escape o Enter para continuar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCerrar();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCerrar]);

  if (!ventaId) return null;

  function imprimir() {
    window.print();
  }

  function abrirWhatsApp() {
    if (!ticket) return;
    const tel = telefonoExtra || ticket.cliente?.telefono;
    const url = linkWhatsApp(tel ?? null, ticket.mensajeWhatsApp) ?? `https://wa.me/?text=${encodeURIComponent(ticket.mensajeWhatsApp)}`;
    window.open(url, "_blank");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-ticket-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-500" />
            <h2 id="modal-ticket-titulo" className="text-base font-semibold">
              ¡Venta registrada con éxito!
            </h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Cerrar modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Contenido: Ticket y acciones */}
        <div className="grid flex-1 gap-6 overflow-y-auto p-5 sm:grid-cols-[1.1fr_1fr]">
          {/* Previsualización del Ticket */}
          <div className="flex justify-center bg-muted/40 p-4 rounded-xl overflow-y-auto max-h-[60vh]">
            {isPending || !ticket ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground animate-pulse">
                Generando comprobante digital...
              </div>
            ) : (
              <TicketTermico ticket={ticket} />
            )}
          </div>

          {/* Botonera de Despacho Inmediato */}
          <div className="flex flex-col justify-between gap-5">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Entregar al cliente
              </span>

              {/* Botón Imprimir Comandera */}
              <Button
                size="lg"
                onClick={imprimir}
                className="w-full justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                <Printer className="size-4" /> Imprimir Ticket (80mm)
              </Button>

              {/* WhatsApp */}
              <div className="flex flex-col gap-1.5 pt-1">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={abrirWhatsApp}
                  disabled={!ticket}
                  className="w-full justify-center gap-2 border-emerald-600/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <MessageCircle className="size-4 text-emerald-600" /> Enviar por WhatsApp
                </Button>

                {!ticket?.telefonoCliente && (
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder="WhatsApp (ej. 261...)"
                      value={telefonoExtra}
                      onChange={(e) => setTelefonoExtra(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Descargar PDF */}
              {ticket && (
                <a
                  href={ticket.linkPublico}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({
                    variant: "ghost",
                    size: "sm",
                    className: "justify-center gap-1.5 text-xs text-muted-foreground",
                  })}
                >
                  <Download className="size-3.5" /> Ver en nueva pestaña
                </a>
              )}
            </div>

            {/* Botón de Nueva Venta */}
            <div className="border-t pt-3">
              <Button
                size="lg"
                variant="secondary"
                onClick={onCerrar}
                className="w-full font-semibold"
              >
                Nueva Venta (Espacio / Esc)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
