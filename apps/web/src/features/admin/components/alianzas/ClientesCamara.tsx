"use client";

import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SinDatos } from "@/components/shared/estado-datos";
import { formatoPesos } from "@/lib/formato";
import { NOMBRE_PLAN } from "../../hooks/use-admin";
import { fechaAR, NOMBRE_ESTADO_CLIENTE, type ClienteCamara } from "../../hooks/use-alianzas";

/** "Hace 3 meses que paga; quedan 21 meses de comisión (hasta el 01/07/2028) si no cancela antes." */
export function resumenCliente(c: ClienteCamara): string {
  if (c.estado === "prueba") return `En el mes gratis hasta el ${fechaAR(c.pruebaHasta)}.`;
  if (c.estado === "sin_convertir") return "Usó la prueba gratis y no pagó.";
  const meses = c.mesesConNosotros ?? 0;
  const paga = meses === 0 ? "Pagó por primera vez este mes" : `Hace ${meses} ${meses === 1 ? "mes" : "meses"} que paga`;
  if (c.estado === "baja") return `${paga.replace("que paga", "que empezó a pagar")}; se dio de baja.`;
  if (!c.mesesComisionRestantes) return `${paga}; ya terminó su plazo de comisión.`;
  return `${paga}; quedan ${c.mesesComisionRestantes} meses de comisión (hasta el ${fechaAR(c.comisionHasta)}) si no cancela antes.`;
}

export function ClientesCamara({ clientes }: { clientes: ClienteCamara[] }) {
  if (clientes.length === 0) return <SinDatos mensaje="Todavía no llegó ningún cliente con sus códigos." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">N.º</TableHead>
          <TableHead>Empresa</TableHead>
          <TableHead className="hidden md:table-cell">Plan</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="hidden text-right md:table-cell">%</TableHead>
          <TableHead className="hidden md:table-cell">Alta</TableHead>
          <TableHead className="hidden md:table-cell">Primer pago</TableHead>
          <TableHead className="hidden text-right md:table-cell">Meses con nosotros</TableHead>
          <TableHead className="hidden text-right md:table-cell">Meses de comisión</TableHead>
          <TableHead className="text-right">Comisión generada</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clientes.map((c) => {
          const estado = NOMBRE_ESTADO_CLIENTE[c.estado];
          return (
            <TableRow key={c.empresaId}>
              <TableCell className="text-right tabular-nums">{c.orden ?? "—"}</TableCell>
              <TableCell className="whitespace-normal">
                <Link prefetch={false} href={`/admin/clientes/${c.empresaId}`} className="font-medium hover:underline">
                  {c.empresa}
                </Link>
                <span className="block text-xs text-muted-foreground">{resumenCliente(c)}</span>
              </TableCell>
              <TableCell className="hidden md:table-cell">{NOMBRE_PLAN(c.plan)}</TableCell>
              <TableCell className={`whitespace-nowrap text-xs font-medium ${estado.clase}`}>{estado.texto}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{c.porcentaje == null ? "—" : `${c.porcentaje}%`}</TableCell>
              <TableCell className="hidden tabular-nums md:table-cell">{fechaAR(c.alta)}</TableCell>
              <TableCell className="hidden tabular-nums md:table-cell">{fechaAR(c.primerPago)}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{c.mesesConNosotros ?? "—"}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">
                {c.mesesComisionRestantes ?? "—"}
                {c.comisionHasta && <span className="block text-xs text-muted-foreground">hasta {fechaAR(c.comisionHasta)}</span>}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatoPesos(c.comisionTotal)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
