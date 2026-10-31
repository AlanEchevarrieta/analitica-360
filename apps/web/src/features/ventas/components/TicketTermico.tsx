"use client";

import { useId } from "react";
import { formatoPesos } from "@/lib/formato";
import type { DatosTicket } from "@/features/documentos/use-documentos";
import { cn } from "@/lib/utils";

/**
 * Componente atómico de presentación pura (<160 líneas).
 * Renderiza el comprobante en formato de tira térmica (80mm) con estilos print optimizados.
 */
export function TicketTermico({
  ticket,
  className,
}: {
  ticket: DatosTicket;
  className?: string;
}) {
  const qrId = useId();
  const fechaFormateada = new Date(ticket.fecha).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div
      className={cn(
        "ticket-imprimible mx-auto w-full max-w-[320px] rounded-lg border bg-white p-5 font-mono text-xs text-slate-900 shadow-xs dark:bg-slate-950 dark:text-slate-100",
        className,
      )}
    >
      {/* 1. Encabezado del Comercio */}
      <div className="flex flex-col items-center text-center">
        {ticket.negocio.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ticket.negocio.logoUrl}
            alt={ticket.negocio.nombre}
            className="mb-2 max-h-12 w-auto object-contain"
          />
        ) : null}
        <h2 className="text-sm font-bold tracking-tight uppercase">
          {ticket.negocio.nombre}
        </h2>
        {ticket.negocio.cuit && (
          <p className="text-[11px] text-muted-foreground">CUIT: {ticket.negocio.cuit}</p>
        )}
        {ticket.negocio.direccion && (
          <p className="text-[11px] text-muted-foreground">{ticket.negocio.direccion}</p>
        )}
        {ticket.negocio.telefono && (
          <p className="text-[11px] text-muted-foreground">Tel: {ticket.negocio.telefono}</p>
        )}
      </div>

      {/* Línea divisoria punteada */}
      <div className="my-3 border-t border-dashed border-slate-300 dark:border-slate-800" />

      {/* 2. Datos del Comprobante */}
      <div className="flex flex-col gap-0.5 text-[11px]">
        <div className="flex justify-between font-semibold">
          <span>COMPROBANTE</span>
          <span>{ticket.numero}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Fecha:</span>
          <span>{fechaFormateada}</span>
        </div>
        {ticket.cliente?.nombre && (
          <div className="flex justify-between text-muted-foreground">
            <span>Cliente:</span>
            <span className="truncate max-w-[170px]">{ticket.cliente.nombre}</span>
          </div>
        )}
      </div>

      <div className="my-3 border-t border-dashed border-slate-300 dark:border-slate-800" />

      {/* 3. Tabla de Productos */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 font-semibold text-[11px] uppercase border-b pb-1">
          <span>Descripción</span>
          <span className="text-right">Cant.</span>
          <span className="text-right">Total</span>
        </div>
        {ticket.items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-2 text-[11px]">
            <span className="truncate pr-1">{item.descripcion}</span>
            <span className="text-right tabular-nums text-muted-foreground">
              {item.cantidad}×
            </span>
            <span className="text-right tabular-nums font-medium">
              {formatoPesos(item.precio * item.cantidad)}
            </span>
          </div>
        ))}
      </div>

      <div className="my-3 border-t border-dashed border-slate-300 dark:border-slate-800" />

      {/* 4. Resumen y Totales */}
      <div className="flex flex-col gap-1 text-[11px]">
        {ticket.resumen.map((r, i) => (
          <div key={i} className="flex justify-between text-muted-foreground">
            <span>{r.etiqueta}:</span>
            <span className="tabular-nums">{formatoPesos(r.monto)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-bold pt-1 border-t">
          <span>TOTAL:</span>
          <span className="tabular-nums">
            {ticket.simbolo} {ticket.total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 5. Detalles de Cobro */}
      {ticket.detalles.length > 0 && (
        <div className="mt-3 flex flex-col gap-0.5 rounded bg-slate-50 dark:bg-slate-900/60 p-2 text-[10px] text-muted-foreground">
          {ticket.detalles.map((d, i) => (
            <p key={i}>{d}</p>
          ))}
        </div>
      )}

      {/* 6. Pie y Código QR */}
      <div className="mt-4 flex flex-col items-center text-center gap-2">
        {ticket.token && (
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              id={qrId}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(ticket.linkPublico)}`}
              alt="QR del ticket"
              className="size-20 rounded bg-white p-1"
            />
            <span className="mt-1 text-[9px] text-muted-foreground">
              Escaneá para ver tu ticket digital
            </span>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          {ticket.pie ?? "¡Gracias por su compra!"}
        </p>
        <p className="text-[8px] text-muted-foreground/60 uppercase tracking-widest">
          Analítica 360 · analitica360.app
        </p>
      </div>
    </div>
  );
}
