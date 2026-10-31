import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/features/sitio/components/Logo";
import { TicketTermico } from "@/features/ventas/components/TicketTermico";
import { BotonImprimirTicket } from "@/features/ventas/components/BotonImprimirTicket";
import type { DatosTicket } from "@/features/documentos/use-documentos";

export const metadata: Metadata = {
  title: "Ticket Digital · Analítica 360",
  description: "Consulta y descarga de comprobante digital de compra.",
  robots: { index: false, follow: false },
};

async function obtenerTicket(token: string): Promise<DatosTicket | null> {
  const api = process.env.API_URL_INTERNA ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
  try {
    const res = await fetch(`${api}/documentos/ticket/ver/${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as DatosTicket;
  } catch {
    return null;
  }
}

export default async function TicketPublicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: token } = await params;
  const ticket = await obtenerTicket(token);

  if (!ticket) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center dark:bg-slate-950">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border bg-white p-8 shadow-sm dark:bg-slate-900">
          <div className="rounded-full bg-amber-500/10 p-3 text-amber-600">
            <AlertCircle className="size-8" />
          </div>
          <h1 className="text-lg font-semibold">Comprobante no disponible</h1>
          <p className="text-sm text-muted-foreground">
            El link de este ticket digital no es válido o ya venció (validez de 60 días). Si lo
            necesitás, comunicate con el comercio para que te lo reenvíe.
          </p>
          <Link
            href="/"
            className={buttonVariants({ variant: "outline", className: "mt-2" })}
          >
            <ArrowLeft className="size-4" /> Ir a Analítica 360
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 dark:bg-slate-950 sm:px-6">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6">
        {/* Cabecera de marca */}
        <div className="flex items-center gap-2">
          <Link href="/" className="inline-flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity">
            <Logo conNombre={true} className="size-6" />
          </Link>
        </div>

        {/* Tira del Ticket Térmico */}
        <div className="w-full drop-shadow-md">
          <TicketTermico ticket={ticket} className="max-w-sm" />
        </div>

        {/* Botonera de Acciones para el Cliente */}
        <div className="flex w-full max-w-sm flex-col gap-2">
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? ""}/documentos/ver/${ticket.token}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({
              className: "w-full justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs",
            })}
          >
            <Download className="size-4" /> Descargar PDF Completo
          </a>
          <BotonImprimirTicket />
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Emitido a través de la plataforma de gestión <b>Analítica 360</b>.
        </p>
      </div>
    </div>
  );
}
