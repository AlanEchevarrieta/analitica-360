"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoPesos } from "@/lib/formato";
import { DocumentoAcciones } from "./DocumentoAcciones";
import { useCobrosDeVenta } from "./use-documentos";

/** En la ficha de la venta: el comprobante (no es factura) y el recibo de cada pago del saldo. */
export function ComprobanteVenta({ ventaId, numero, anulada }: { ventaId: string; numero: string | null; anulada: boolean }) {
  const { data: cobros } = useCobrosDeVenta(ventaId);
  const [abierto, setAbierto] = useState<string | null>(null);
  if (anulada) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="size-4" /> Comprobante para el cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">Con tu logo y el detalle de la compra. No reemplaza a la factura.</p>
        <DocumentoAcciones tipo="venta" id={ventaId} nombre={`Comprobante ${numero ?? ""}`.trim()} />
        {cobros && cobros.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <span className="text-xs font-medium text-muted-foreground">Recibos de los pagos del saldo</span>
            {cobros.map((c) => (
              <div key={c.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums">{new Date(c.fecha).toLocaleDateString("es-AR")}</span>
                  <span className="font-medium tabular-nums">{formatoPesos(c.monto)}</span>
                  {c.recibo && <span className="text-muted-foreground">{c.recibo}</span>}
                  <Button size="sm" variant="ghost" className="h-7 px-2" aria-expanded={abierto === c.id} onClick={() => setAbierto(abierto === c.id ? null : c.id)}>
                    {abierto === c.id ? "Cerrar" : "Recibo"}
                  </Button>
                </div>
                {abierto === c.id && <DocumentoAcciones tipo="recibo" id={c.id} nombre={`Recibo ${c.recibo ?? ""}`.trim()} />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
