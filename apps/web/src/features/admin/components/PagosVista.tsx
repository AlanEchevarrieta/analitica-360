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
import { fechaCorta, useAccionesAdmin, useEmpresasAdmin, usePagosAdmin } from "../hooks/use-admin";
import { Indicador, Panel } from "./comunes";

const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";
const aMonto = (t: string) => Number(t.replace(/\./g, "").replace(",", "."));

export function PagosVista() {
  const [estado, setEstado] = useState("");
  const [periodo, setPeriodo] = useState(hoyAR().slice(0, 7));
  const pagos = usePagosAdmin(estado, periodo);
  const empresas = useEmpresasAdmin();
  const { registrarPago } = useAccionesAdmin();
  const [nuevo, setNuevo] = useState({ empresaId: "", monto: "", metodo: "transferencia", periodo: hoyAR().slice(0, 7), notas: "" });

  const lista = pagos.data ?? [];
  const confirmados = lista.filter((p) => p.estado === "confirmado");
  const total = confirmados.reduce((a, p) => a + p.montoArs, 0);
  const vivas = (empresas.data ?? []).filter((e) => !e.baja);

  function registrar() {
    if (!nuevo.empresaId || !(aMonto(nuevo.monto) > 0)) return toast.error("Elegí el cliente y el monto.");
    registrarPago.mutate(
      { empresaId: nuevo.empresaId, monto: aMonto(nuevo.monto), metodo: nuevo.metodo, periodo: nuevo.periodo, notas: nuevo.notas },
      {
        onSuccess: () => {
          toast.success("Pago registrado: la suscripción del cliente queda activa hasta fin de ese mes");
          setNuevo((n) => ({ ...n, monto: "", notas: "" }));
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Pagos</h1>
        <p className="text-sm text-muted-foreground">Los cobros son manuales (transferencia, Mercado Pago…): registralos acá y la suscripción se extiende sola.</p>
      </div>

      <Panel titulo="Registrar un pago cobrado">
        <div className="flex flex-wrap gap-2">
          <select className={selectClase} aria-label="Cliente" value={nuevo.empresaId} onChange={(e) => setNuevo({ ...nuevo, empresaId: e.target.value })}>
            <option value="">Cliente…</option>
            {vivas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <Input className="w-32" inputMode="decimal" placeholder="Monto $" aria-label="Monto" value={nuevo.monto} onChange={(e) => setNuevo({ ...nuevo, monto: e.target.value })} />
          <select className={selectClase} aria-label="Método" value={nuevo.metodo} onChange={(e) => setNuevo({ ...nuevo, metodo: e.target.value })}>
            <option value="transferencia">Transferencia</option>
            <option value="mercadopago">Mercado Pago</option>
            <option value="efectivo">Efectivo</option>
            <option value="otro">Otro</option>
          </select>
          <Input type="month" className="w-40" aria-label="Mes que paga" value={nuevo.periodo} onChange={(e) => setNuevo({ ...nuevo, periodo: e.target.value })} />
          <Input className="min-w-40 flex-1" placeholder="Notas (opcional)" aria-label="Notas" value={nuevo.notas} onChange={(e) => setNuevo({ ...nuevo, notas: e.target.value })} />
          <Button onClick={registrar} disabled={registrarPago.isPending}>
            Registrar pago
          </Button>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador etiqueta="Cobrado en el período" valor={formatoPesos(total)} detalle={`${confirmados.length} pagos confirmados`} />
        <Indicador etiqueta="Clientes que pagaron" valor={new Set(confirmados.map((p) => p.empresaId)).size} />
        <Indicador etiqueta="Pago promedio" valor={formatoPesos(confirmados.length ? total / confirmados.length : 0)} />
      </div>

      <Panel
        titulo="Pagos registrados"
        accion={
          <div className="flex flex-wrap gap-2">
            <select className={selectClase} aria-label="Estado del pago" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="confirmado">Confirmados</option>
              <option value="pendiente">Pendientes</option>
              <option value="anulado">Anulados</option>
            </select>
            <Input type="month" className="w-40" aria-label="Mes" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
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
                <TableHead>Mes que paga</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="tabular-nums">{fechaCorta(p.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={`/admin/clientes/${p.empresaId}`} className="hover:underline">
                      {p.empresaNombre}
                    </Link>
                    {p.notas && <span className="block text-xs text-muted-foreground">{p.notas}</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">{p.periodo ?? "—"}</TableCell>
                  <TableCell className="capitalize">{p.metodo}</TableCell>
                  <TableCell className="capitalize">{p.estado}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatoPesos(p.montoArs)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
