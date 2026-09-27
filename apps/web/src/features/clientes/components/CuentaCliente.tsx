"use client";

import { useState } from "react";
import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FORMAS_PAGO, etiquetaPago } from "@/features/ventas/types/nueva-venta";
import { useAcceso } from "@/hooks/use-acceso";
import { formatoPesos } from "@/lib/formato";
import { hoyAR } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { linkWhatsApp } from "../hooks/use-clientes";
import { mensajeRecordatorio, useAccionesCuenta, useCuentaCliente } from "../hooks/use-cuenta-corriente";

const fecha = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const haceDias = (dias: number, sujeto: string) => (dias === 0 ? `${sujeto} es de hoy` : `${sujeto} es de hace ${dias} ${dias === 1 ? "día" : "días"}`);

/** Cuenta corriente de un cliente (en su ficha): saldo, pagos y resumen de cuenta. */
export function CuentaCliente({ clienteId }: { clienteId: string }) {
  const { data } = useCuentaCliente(clienteId);
  const { organization } = useOrganization();
  const { puedeHacer } = useAcceso();
  const { cobrar, anular } = useAccionesCuenta(clienteId);
  const [monto, setMonto] = useState("");
  const [forma, setForma] = useState("efectivo");
  const [dia, setDia] = useState(hoyAR());
  // Sin cuenta corriente (nunca le vendió a cuenta ni con seña): no se muestra nada.
  if (!data || (data.movimientos.length === 0 && data.cobros.length === 0)) return null;
  const n = Number(monto.replace(",", "."));
  const wa = data.cliente.telefono && data.saldo > 0 ? linkWhatsApp(data.cliente.telefono, mensajeRecordatorio(data.cliente.nombre, organization?.name ?? "nuestro negocio", data.saldo)) : null;

  function registrar() {
    if (!(n > 0)) return toast.error("Poné cuánto pagó.");
    cobrar.mutate(
      { monto: n, formaPago: forma, fecha: dia, notas: null },
      {
        onSuccess: () => {
          toast.success(`Pago de ${formatoPesos(n)} registrado`);
          setMonto("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Cuenta corriente</CardTitle>
          <CardDescription>
            {data.saldo > 0 ? (
              <>
                Debe <b className="text-foreground">{formatoPesos(data.saldo)}</b> en {data.pendientes.length} {data.pendientes.length === 1 ? "venta" : "ventas"}
                {data.pendientes[0] && ` · ${haceDias(Math.max(...data.pendientes.map((p) => p.dias)), "la más vieja")}`}
              </>
            ) : (
              "Está al día: no debe nada."
            )}
          </CardDescription>
        </div>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
            <MessageCircle aria-hidden /> Recordarle por WhatsApp
          </a>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data.saldo > 0 && puedeHacer("registrar_ventas") && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cc-monto">Pagó $</Label>
              <Input id="cc-monto" className="w-32" inputMode="decimal" placeholder={String(data.saldo)} value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cc-forma">Cómo</Label>
              <select id="cc-forma" className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={forma} onChange={(e) => setForma(e.target.value)}>
                {FORMAS_PAGO.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cc-fecha">Día</Label>
              <Input id="cc-fecha" type="date" className="w-40" max={hoyAR()} value={dia} onChange={(e) => setDia(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={() => setMonto(String(data.saldo))}>
              Todo
            </Button>
            <Button onClick={registrar} disabled={cobrar.isPending}>
              {cobrar.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Registrar pago
            </Button>
            <p className="basis-full text-xs text-muted-foreground">Se aplica primero a las ventas más viejas.</p>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Movimiento</TableHead>
              <TableHead className="text-right">Compró</TableHead>
              <TableHead className="text-right">Pagó</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...data.movimientos].reverse().map((m, i) => (
              <TableRow key={`${m.fecha}-${i}`}>
                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{fecha(m.fecha)}</TableCell>
                <TableCell>
                  {m.ventaId && m.debe > 0 ? (
                    <Link href={`/ventas/${m.ventaId}`} className="hover:underline">
                      {m.concepto}
                    </Link>
                  ) : (
                    m.concepto
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{m.debe ? formatoPesos(m.debe) : ""}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">{m.haber ? formatoPesos(m.haber) : ""}</TableCell>
                <TableCell className={cn("text-right font-medium tabular-nums", m.saldo > 0 && "text-foreground")}>{formatoPesos(m.saldo)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {data.cobros.length > 0 && (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Pagos registrados</span>
            {data.cobros.map((c) => (
              <div key={c.id} className={cn("flex flex-wrap items-center gap-2", c.anulado && "opacity-50")}>
                <span className="tabular-nums">{fecha(c.fecha)}</span>
                <span className="font-medium tabular-nums">{formatoPesos(c.monto)}</span>
                <span className="text-muted-foreground">
                  {etiquetaPago(c.formaPago)}
                  {c.ventas.length > 0 && ` · ${c.ventas.join(", ")}`}
                </span>
                {c.anulado ? (
                  <span className="text-xs text-destructive">anulado</span>
                ) : (
                  puedeHacer("anular_ventas") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() =>
                        window.confirm(`¿Anular el pago de ${formatoPesos(c.monto)}? Vuelve a quedar como deuda.`) &&
                        anular.mutate(c.id, { onSuccess: () => toast.success("Pago anulado"), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo anular") })
                      }
                    >
                      Anular
                    </Button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
