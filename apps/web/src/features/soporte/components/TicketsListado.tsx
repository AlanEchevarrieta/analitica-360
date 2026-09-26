"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoFechaHora } from "@/lib/formato";
import { CATEGORIAS, ESTADOS, PRIORIDADES, useTickets } from "../hooks/use-soporte";

export function EstadoTicketBadge({ estado }: { estado: keyof typeof ESTADOS }) {
  const e = ESTADOS[estado] ?? ESTADOS.abierto;
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${e.clase}`}>{e.etiqueta}</span>;
}

export function TicketsListado() {
  const { data, isPending, isError, error, refetch } = useTickets();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">¿Algo no funciona o tenés una duda? Escribinos: te respondemos en 24 horas hábiles.</p>
        <Link href="/soporte/nuevo" className={buttonVariants()}>
          <Plus aria-hidden /> Nuevo ticket
        </Link>
      </div>
      <Card>
        <CardContent>
          {isPending ? (
            <CargandoFilas filas={5} />
          ) : isError ? (
            <ErrorDatos error={error} onReintentar={() => refetch()} />
          ) : data.length === 0 ? (
            <SinDatos mensaje="Todo en orden: no tenés consultas abiertas. Si necesitás ayuda, creá un ticket." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium tabular-nums">
                      <Link href={`/soporte/${t.id}`} className="hover:underline">
                        {t.numeroTicket ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-80 truncate">
                      <Link href={`/soporte/${t.id}`} className="hover:underline">
                        {t.asunto}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{CATEGORIAS[t.categoria] ?? t.categoria}</TableCell>
                    <TableCell className="text-muted-foreground">{PRIORIDADES[t.prioridad] ?? t.prioridad}</TableCell>
                    <TableCell>
                      <EstadoTicketBadge estado={t.estado} />
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{formatoFechaHora(t.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
