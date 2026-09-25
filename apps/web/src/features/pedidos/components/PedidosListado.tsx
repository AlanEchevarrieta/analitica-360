"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { Paginacion } from "@/components/shared/paginacion";
import { formatoFechaHora, formatoPesos } from "@/lib/formato";
import { PEDIDOS_POR_PAGINA, useColaboradores, usePedidos } from "../hooks/use-pedidos";
import { ESTADOS, ORIGENES, type EstadoPedido, type OrigenPedido } from "../types";
import { EstadoPedidoBadge } from "./EstadoPedidoBadge";

export function PedidosListado() {
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<EstadoPedido | "">("");
  const [origen, setOrigen] = useState<OrigenPedido | "">("");
  const { data, isPending, isError, error, refetch, isFetching } = usePedidos(pagina, estado, origen);
  const colaboradores = useColaboradores();
  const nombreDe = (id: string | null) => colaboradores.data?.find((c) => c.id === id)?.nombre ?? null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Estado">
          {[{ valor: "" as const, etiqueta: "Todos" }, ...ESTADOS].map((e) => (
            <Button
              key={e.valor || "todos"}
              size="sm"
              variant={estado === e.valor ? "secondary" : "ghost"}
              aria-pressed={estado === e.valor}
              onClick={() => {
                setEstado(e.valor);
                setPagina(1);
              }}
            >
              {e.etiqueta}
            </Button>
          ))}
          <select
            className="ml-auto h-8 rounded-lg border bg-transparent px-2 text-sm"
            aria-label="Origen"
            value={origen}
            onChange={(e) => {
              setOrigen(e.target.value as OrigenPedido | "");
              setPagina(1);
            }}
          >
            <option value="">Todos los orígenes</option>
            {Object.entries(ORIGENES).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>

        {isPending ? (
          <CargandoFilas filas={8} />
        ) : isError ? (
          <ErrorDatos error={error} onReintentar={() => refetch()} />
        ) : data.items.length === 0 ? (
          <SinDatos mensaje={estado || origen ? "No hay pedidos con esos filtros." : "Todavía no hay pedidos."} />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium tabular-nums">
                      <Link href={`/pedidos/${p.id}`} className="hover:underline">
                        {p.numeroPedido}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatoFechaHora(p.createdAt)}</TableCell>
                    <TableCell>{p.clienteNombre ?? <span className="text-muted-foreground">Sin nombre</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{ORIGENES[p.origen] ?? p.origen}</TableCell>
                    <TableCell className="text-muted-foreground">{nombreDe(p.asignadoAId) ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatoPesos(p.total)}</TableCell>
                    <TableCell>
                      <EstadoPedidoBadge estado={p.estado} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && <Paginacion pagina={pagina} porPagina={PEDIDOS_POR_PAGINA} total={data.total} onCambiar={setPagina} />}
      </CardContent>
    </Card>
  );
}
