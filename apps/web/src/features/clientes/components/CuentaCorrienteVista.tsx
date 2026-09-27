"use client";

import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { linkWhatsApp } from "../hooks/use-clientes";
import { mensajeRecordatorio, TRAMOS, useCuentaCorriente, type Deudor } from "../hooks/use-cuenta-corriente";

const tramoDe = (d: Deudor) => TRAMOS[d.dias > 90 ? 3 : d.dias > 60 ? 2 : d.dias > 30 ? 1 : 0];

/** Quién te debe, cuánto y desde cuándo. */
export function CuentaCorrienteVista() {
  const { data, isPending, isError, error, refetch } = useCuentaCorriente();
  const { organization } = useOrganization();
  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Te deben en total</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoPesos(data.total)}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {data.deudores.length} {data.deudores.length === 1 ? "cliente" : "clientes"}
            </p>
          </CardHeader>
        </Card>
        {TRAMOS.map((t) => (
          <Card size="sm" key={t.id}>
            <CardHeader>
              <CardDescription>{t.etiqueta}</CardDescription>
              <CardTitle className={cn("text-xl tabular-nums", data.tramos[t.id] > 0 && t.clase)}>{formatoPesos(data.tramos[t.id])}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes con saldo</CardTitle>
          <CardDescription>De mayor a menor deuda. Tocá un cliente para ver su cuenta y registrar un pago.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.deudores.length === 0 ? (
            <SinDatos mensaje="Nadie te debe. Cuando vendas a cuenta (fiado) o con seña, lo vas a ver acá." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Desde hace</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.deudores.map((d) => {
                  const t = tramoDe(d);
                  const wa = d.telefono ? linkWhatsApp(d.telefono, mensajeRecordatorio(d.nombre, organization?.name ?? "nuestro negocio", d.saldo)) : null;
                  return (
                    <TableRow key={d.clienteId ?? d.nombre}>
                      <TableCell>
                        {d.clienteId ? (
                          <Link href={`/clientes/${d.clienteId}`} className="font-medium hover:underline">
                            {d.nombre}
                          </Link>
                        ) : (
                          <span className="font-medium">{d.nombre}</span>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          {d.ventas} {d.ventas === 1 ? "venta" : "ventas"} con saldo
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatoPesos(d.saldo)}</TableCell>
                      <TableCell className={cn("hidden text-right tabular-nums sm:table-cell", t.clase)}>
                        {d.dias === 0 ? "hoy" : `${d.dias} ${d.dias === 1 ? "día" : "días"}`}
                      </TableCell>
                      <TableCell className="text-right">
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })} aria-label={`Recordarle a ${d.nombre} por WhatsApp`}>
                            <MessageCircle aria-hidden /> <span className="hidden sm:inline">Recordar</span>
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
