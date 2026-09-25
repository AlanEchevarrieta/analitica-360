"use client";

import { Printer } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { formatoPesos } from "@/lib/formato";
import { usePedido, useRemitente } from "../hooks/use-pedidos";
import { etiquetaItem } from "../types";

/** Remito imprimible (Ctrl+P / "Guardar como PDF"). Reemplaza el PDF de jspdf del legacy. */
export function RemitoPedido({ id }: { id: string }) {
  const { data: p, isPending, isError, error } = usePedido(id);
  const remitente = useRemitente();
  const { organization } = useOrganization();

  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} />;
  const r = remitente.data;

  return (
    <div className="flex flex-col gap-4">
      <Button className="self-end print:hidden" onClick={() => window.print()}>
        <Printer aria-hidden /> Imprimir o guardar PDF
      </Button>
      <article className="mx-auto w-full max-w-2xl rounded-lg border bg-white p-8 text-sm text-black print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-lg font-semibold">{r?.nombre || organization?.name}</p>
            {r?.direccion && <p>{r.direccion}</p>}
            {r?.telefono && <p>Tel: {r.telefono}</p>}
            {r?.email && <p>{r.email}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">REMITO</p>
            <p>Pedido {p.numeroPedido}</p>
            <p>{new Date(p.createdAt).toLocaleDateString("es-AR")}</p>
          </div>
        </header>
        <section className="grid grid-cols-2 gap-4 border-b py-4">
          <div>
            <p className="text-xs uppercase text-neutral-500">Destinatario</p>
            <p className="font-medium">{p.clienteNombre}</p>
            {p.clienteTelefono && <p>Tel: {p.clienteTelefono}</p>}
          </div>
          <div>
            <p className="text-xs uppercase text-neutral-500">Dirección de entrega</p>
            <p>{p.direccionEnvio}</p>
            <p>{[p.localidad, p.provincia, p.codigoPostal].filter(Boolean).join(", ")}</p>
            {p.transportista && <p>Transporte: {p.transportista}{p.numeroSeguimiento ? ` · ${p.numeroSeguimiento}` : ""}</p>}
          </div>
        </section>
        <table className="mt-4 w-full">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1">Producto</th>
              <th className="py-1 text-right">Cant.</th>
              <th className="py-1 text-right">Precio</th>
              <th className="py-1 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {p.items.map((i) => (
              <tr key={i.id} className="border-b">
                <td className="py-1">{etiquetaItem(i)}</td>
                <td className="py-1 text-right">{i.cantidad}</td>
                <td className="py-1 text-right">{formatoPesos(i.precioUnitario)}</td>
                <td className="py-1 text-right">{formatoPesos(i.cantidad * i.precioUnitario)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-2 text-right font-semibold">Total</td>
              <td className="py-2 text-right font-semibold">{formatoPesos(p.total)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-10 text-neutral-500">Recibí conforme: ______________________ Aclaración: ______________________</p>
      </article>
    </div>
  );
}
