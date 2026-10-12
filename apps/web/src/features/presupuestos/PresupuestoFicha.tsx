"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DocumentoAcciones } from "@/features/documentos/DocumentoAcciones";
import { useAccionesOt } from "@/features/ordenes-trabajo/use-ordenes-trabajo";
import { usePlan } from "@/hooks/use-plan";
import { formatoPesos } from "@/lib/formato";
import { EstadoPresupuestoChip } from "./PresupuestosListado";
import { PresupuestoForm } from "./PresupuestoForm";
import { formatoEnMoneda, useAccionesPresupuesto, usePresupuesto, type PresupuestoFicha as Ficha } from "./use-presupuestos";

const dia = (f: string) => new Date(f.length === 10 ? `${f}T12:00:00` : f).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
const error = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo hacer");

function Acciones({ p, onEditar }: { p: Ficha; onEditar: () => void }) {
  const { estado, borrar } = useAccionesPresupuesto();
  const { desdePresupuesto } = useAccionesOt();
  const plan = usePlan();
  const router = useRouter();
  if (p.estado === "aceptado") {
    return p.ventaId ? (
      <Link href={`/ventas/${p.ventaId}`} className={buttonVariants({ variant: "outline" })}>
        Ver la venta {p.numeroVenta}
      </Link>
    ) : null;
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/ventas/nueva?presupuesto=${p.id}`} className={buttonVariants()}>
        <ShoppingCart aria-hidden /> Pasar a venta
      </Link>
      {plan.incluye("ordenes_trabajo") && (
        <Button
          variant="outline"
          disabled={desdePresupuesto.isPending}
          onClick={() => {
            const equipo = window.prompt("¿Qué deja el cliente? (equipo o trabajo)");
            if (equipo?.trim())
              desdePresupuesto.mutate(
                { presupuestoId: p.id, equipo: equipo.trim(), problema: null, responsableId: null, fechaPrometida: null },
                { onSuccess: (o) => (toast.success(`Orden ${o.numero} creada`), router.push(`/ordenes-trabajo/${o.id}`)), onError: error },
              );
          }}
        >
          <Wrench aria-hidden /> Crear orden de trabajo
        </Button>
      )}
      <Button variant="outline" onClick={onEditar}>
        {p.estado === "vencido" ? "Renovar o editar" : "Editar"}
      </Button>
      {p.estado === "rechazado" ? (
        <Button variant="ghost" disabled={estado.isPending} onClick={() => estado.mutate({ id: p.id, estado: "pendiente" }, { onError: error })}>
          Volver a pendiente
        </Button>
      ) : (
        <Button variant="ghost" disabled={estado.isPending} onClick={() => estado.mutate({ id: p.id, estado: "rechazado" }, { onSuccess: () => toast.success("Marcado como rechazado"), onError: error })}>
          El cliente no aceptó
        </Button>
      )}
      <Button
        variant="ghost"
        className="text-destructive"
        disabled={borrar.isPending}
        onClick={() => window.confirm(`¿Borrar el presupuesto ${p.numero}?`) && borrar.mutate(p.id, { onSuccess: () => (toast.success("Presupuesto borrado"), router.push("/ventas/presupuestos")), onError: error })}
      >
        Borrar
      </Button>
    </div>
  );
}

/** Ficha del presupuesto: detalle, mandar al cliente, pasar a venta, editar o marcar como rechazado. */
export function PresupuestoFicha({ id }: { id: string }) {
  const { data: p, isPending, isError, error: err, refetch } = usePresupuesto(id);
  const [editando, setEditando] = useState(false);

  if (isPending) return <CargandoFilas />;
  if (isError) return <ErrorDatos error={err} onReintentar={() => refetch()} />;
  if (editando) return <PresupuestoForm inicial={p} onListo={() => setEditando(false)} onCancelar={() => setEditando(false)} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/ventas/presupuestos" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a presupuestos">
          <ArrowLeft />
        </Link>
        <h1 className="text-xl font-semibold tabular-nums">Presupuesto {p.numero}</h1>
        <EstadoPresupuestoChip estado={p.estado} />
      </div>
      <p className="text-sm text-muted-foreground">
        {p.cliente?.nombre ?? p.clienteNombre ?? "Sin cliente"} · {dia(p.fecha)} · válido hasta el {dia(p.validoHasta)}
      </p>

      <Acciones p={p} onEditar={() => setEditando(true)} />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Precio</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.descripcion}</TableCell>
                    <TableCell className="text-right tabular-nums">{i.cantidad}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatoPesos(i.precioUnitario)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoPesos(i.cantidad * i.precioUnitario)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 flex flex-col items-end gap-1 text-sm">
              {p.descuento > 0 && (
                <>
                  <span className="text-muted-foreground">Subtotal {formatoPesos(p.subtotal)}</span>
                  <span className="text-muted-foreground">Descuento -{formatoPesos(p.descuento)}</span>
                </>
              )}
              <span className="text-lg font-semibold tabular-nums">Total {formatoPesos(p.total)}</span>
              {p.enMoneda && p.cotizacion && (
                <span className="text-right">
                  <span className="font-medium text-primary tabular-nums">Para el cliente: {formatoEnMoneda(p.enMoneda.total, p.moneda)}</span>
                  <span className="block text-xs text-muted-foreground">
                    1 {p.moneda} = {formatoPesos(p.cotizacion)} · {p.cotizacionDe}
                  </span>
                </span>
              )}
            </div>
            {p.notas && <p className="mt-3 whitespace-pre-line rounded-md bg-muted/50 p-2 text-sm">{p.notas}</p>}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Mandarlo al cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentoAcciones tipo="presupuesto" id={p.id} nombre={`Presupuesto ${p.numero}`} emailCliente={p.cliente?.email} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
