"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { fechaCorta, useEmpresasAdmin, type EmpresaAdmin } from "../hooks/use-admin";
import { EtiquetaAlerta, EtiquetaEstado, EtiquetaPlan, Panel, variacion } from "./comunes";

const FILTROS: { valor: string; etiqueta: string; aplica: (e: EmpresaAdmin) => boolean }[] = [
  { valor: "activos", etiqueta: "Activos", aplica: (e) => !e.baja },
  { valor: "alertas", etiqueta: "Con alertas", aplica: (e) => !e.baja && e.alertas.length > 0 },
  { valor: "prueba", etiqueta: "En prueba", aplica: (e) => !e.baja && e.estado === "periodo_prueba" },
  { valor: "vencidos", etiqueta: "Vencidos", aplica: (e) => !e.baja && e.alertas.includes("vencida") },
  { valor: "demo", etiqueta: "Demo", aplica: (e) => e.esDemo },
  { valor: "bajas", etiqueta: "Dados de baja", aplica: (e) => Boolean(e.baja) },
  { valor: "todos", etiqueta: "Todos", aplica: () => true },
];

export function ClientesVista() {
  const { data, isPending, isError, error, refetch } = useEmpresasAdmin();
  const [filtro, setFiltro] = useState("activos");
  const [busqueda, setBusqueda] = useState("");

  const lista = useMemo(() => {
    const f = FILTROS.find((x) => x.valor === filtro) ?? FILTROS[0];
    const q = busqueda.trim().toLowerCase();
    return (data ?? []).filter((e) => f.aplica(e) && (!q || e.nombre.toLowerCase().includes(q)));
  }, [data, filtro, busqueda]);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">Cada comercio con su plan, cuánto usa la app y señales para actuar a tiempo.</p>
      </div>
      <Panel
        titulo={`${lista.length} ${lista.length === 1 ? "cliente" : "clientes"}`}
        accion={<Input className="w-56" placeholder="Buscar por nombre" aria-label="Buscar cliente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />}
      >
        <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Filtrar clientes">
          {FILTROS.map((f) => {
            const cuenta = (data ?? []).filter(f.aplica).length;
            return (
              <Button key={f.valor} size="sm" variant={filtro === f.valor ? "secondary" : "ghost"} aria-pressed={filtro === f.valor} onClick={() => setFiltro(f.valor)}>
                {f.etiqueta} <span className="text-muted-foreground tabular-nums">{cuenta}</span>
              </Button>
            );
          })}
        </div>
        {isPending ? (
          <CargandoFilas filas={6} />
        ) : isError ? (
          <ErrorDatos error={error} onReintentar={() => refetch()} />
        ) : lista.length === 0 ? (
          <SinDatos mensaje="Ningún cliente con este filtro." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Vendió (30 días)</TableHead>
                <TableHead>Última venta</TableHead>
                <TableHead className="text-right">Usuarios</TableHead>
                <TableHead>Señales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((e) => {
                const v = variacion(e.monto30, e.montoPrevio30);
                return (
                  <TableRow key={e.id} className={cn(e.baja && "opacity-50")}>
                    <TableCell>
                      <Link href={`/admin/clientes/${e.id}`} className="font-medium hover:underline">
                        {e.nombre}
                      </Link>
                      <span className="ml-2 space-x-1">
                        {e.esDemo && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[11px] font-medium text-sky-400">DEMO</span>}
                        {e.baja && <span className="text-[11px] text-muted-foreground">baja {fechaCorta(e.baja)}</span>}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">Cliente desde {fechaCorta(e.alta)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-col items-start gap-1">
                        <EtiquetaPlan plan={e.plan} />
                        <EtiquetaEstado estado={e.estado} />
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{fechaCorta(e.vencimiento)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatoPesos(e.monto30)}
                      <span className="block text-[11px] text-muted-foreground">
                        {formatoNumero(e.ventas30)} ventas
                        {v && <span className={cn("ml-1", v.tono === "bien" ? "text-emerald-400" : v.tono === "mal" ? "text-red-400" : "")}>{v.texto}</span>}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {e.ultimaVenta ? fechaCorta(e.ultimaVenta) : "Nunca"}
                      {e.diasSinVender != null && <span className="block text-[11px] text-muted-foreground">hace {e.diasSinVender} días</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.usuarios}</TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {e.alertas.map((a) => (
                          <EtiquetaAlerta key={a} alerta={a} />
                        ))}
                        {e.ticketsAbiertos > 0 && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[11px] font-medium text-violet-300">{e.ticketsAbiertos} ticket(s)</span>}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
