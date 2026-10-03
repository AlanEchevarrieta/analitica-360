"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoPesos } from "@/lib/formato";
import { hoyAR } from "@/lib/periodos";
import { fechaCorta, NOMBRE_PLAN, usePagosAdmin } from "../hooks/use-admin";
import { fechaAR, NOMBRE_CICLO, useAccionesAlianzas, type Ciclo } from "../hooks/use-alianzas";
import { Indicador, Panel } from "./comunes";
import { RegistrarCobro } from "./RegistrarCobro";
import { CuotasVencidasPanel } from "./alianzas/CuotasCliente";

const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";

export function PagosVista() {
  const [estado, setEstado] = useState("");
  const [periodo, setPeriodo] = useState(hoyAR().slice(0, 7));
  const pagos = usePagosAdmin(estado, periodo);
  const { devolverPago } = useAccionesAlianzas();

  const lista = pagos.data ?? [];
  const confirmados = lista.filter((p) => p.estado === "confirmado");
  const total = confirmados.reduce((a, p) => a + p.montoArs, 0);
  const descuentos = confirmados.reduce((a, p) => a + (p.descuentoArs ?? 0), 0);

  function devolver(id: string) {
    const motivo = window.prompt("¿Por qué se devuelve este pago? (queda registrado y, si generó comisión, se descuenta)");
    if (!motivo?.trim()) return;
    devolverPago.mutate(
      { id, motivo },
      { onSuccess: () => toast.success("Pago marcado como devuelto"), onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Pagos</h1>
        <p className="text-sm text-muted-foreground">Los cobros son manuales (transferencia, Mercado Pago…): registralos acá y la suscripción se extiende sola.</p>
      </div>

      <RegistrarCobro />

      <CuotasVencidasPanel />

      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador etiqueta="Cobrado en el período" valor={formatoPesos(total)} detalle={`${confirmados.length} pagos confirmados`} />
        <Indicador etiqueta="Clientes que pagaron" valor={new Set(confirmados.map((p) => p.empresaId)).size} />
        <Indicador etiqueta="Descuentos por cupones" valor={formatoPesos(descuentos)} />
      </div>

      <Panel
        titulo="Pagos registrados"
        accion={
          <div className="flex flex-wrap gap-2">
            <select className={selectClase} aria-label="Estado del pago" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="confirmado">Confirmados</option>
              <option value="devuelto">Devueltos</option>
            </select>
            <Input type="month" className="w-40" aria-label="Mes de cobro" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            {periodo && (
              <Button size="sm" variant="ghost" onClick={() => setPeriodo("")}>
                Todos los meses
              </Button>
            )}
          </div>
        }
      >
        {pagos.isPending ? (
          <CargandoFilas filas={4} />
        ) : pagos.isError ? (
          <ErrorDatos error={pagos.error} onReintentar={() => pagos.refetch()} />
        ) : lista.length === 0 ? (
          <SinDatos mensaje="No hay pagos con estos filtros." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="hidden md:table-cell">Cubre</TableHead>
                <TableHead className="hidden text-right md:table-cell">Lista</TableHead>
                <TableHead className="hidden text-right md:table-cell">Descuento</TableHead>
                <TableHead className="text-right">Cobrado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((p) => (
                <TableRow key={p.id} className={p.estado === "devuelto" ? "opacity-60" : undefined}>
                  <TableCell className="tabular-nums">{fechaCorta(p.createdAt)}</TableCell>
                  <TableCell>
                    <Link prefetch={false} href={`/admin/clientes/${p.empresaId}`} className="hover:underline">
                      {p.empresaNombre}
                    </Link>
                    <span className="block text-xs text-muted-foreground capitalize">
                      {p.metodo}
                      {p.codigo ? ` · ${p.codigo}` : ""}
                      {p.notas ? ` · ${p.notas}` : ""}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.plan ? `${NOMBRE_PLAN(p.plan)} ${NOMBRE_CICLO[p.ciclo as Ciclo]?.toLowerCase() ?? ""}` : "—"}
                    {p.cuota && <span className="block text-xs text-muted-foreground">Cuota {p.cuota} de {p.cuotas}</span>}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap tabular-nums md:table-cell">{p.periodoDesde ? `${fechaAR(p.periodoDesde)} → ${fechaAR(p.periodoHasta)}` : (p.periodo ?? "—")}</TableCell>
                  <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{p.precioLista == null ? "—" : formatoPesos(p.precioLista)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{p.descuentoArs ? formatoPesos(p.descuentoArs) : "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatoPesos(p.montoArs)}
                    {p.estado === "devuelto" && <span className="block text-xs font-normal text-red-400" title={p.devolucionMotivo ?? undefined}>Devuelto</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.estado === "confirmado" && (
                      <Button size="sm" variant="ghost" onClick={() => devolver(p.id)} disabled={devolverPago.isPending}>
                        Devolver
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
