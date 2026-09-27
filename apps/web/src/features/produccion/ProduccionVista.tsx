"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Hammer, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoFechaHora, formatoNumero, formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { useAccionesProduccion, useOrdenes, useRecetas } from "./hooks";

/** Producción: órdenes (lo que se fabricó) y recetas (cómo se fabrica cada cosa). */
export function ProduccionVista() {
  const router = useRouter();
  const tab = useSearchParams().get("tab") === "recetas" ? "recetas" : "ordenes";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Producción</h1>
          <p className="text-sm text-muted-foreground">Lo que fabricás, con qué insumos y cuánto te cuesta.</p>
        </div>
        <Link href="/produccion/receta" className={buttonVariants({ variant: "outline" })}>
          <Plus aria-hidden /> Nueva receta
        </Link>
        <Link href="/produccion/nueva" className={buttonVariants()}>
          <Hammer aria-hidden /> Fabricar
        </Link>
      </div>
      <nav className="flex gap-1 border-b" aria-label="Secciones de producción">
        {[
          { v: "ordenes", t: "Órdenes de producción" },
          { v: "recetas", t: "Recetas y kits" },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            aria-current={tab === o.v ? "page" : undefined}
            onClick={() => router.replace(o.v === "recetas" ? "/produccion?tab=recetas" : "/produccion")}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === o.v ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {o.t}
          </button>
        ))}
      </nav>
      {tab === "recetas" ? <Recetas /> : <Ordenes />}
    </div>
  );
}

function Ordenes() {
  const { data, isPending, isError, error, refetch } = useOrdenes();
  const { anularOrden } = useAccionesProduccion();
  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  if (data.length === 0) return <SinDatos mensaje="Todavía no fabricaste nada. Cargá una receta y tocá “Fabricar”." />;
  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Costo c/u</TableHead>
              <TableHead className="hidden text-right md:table-cell">Materiales</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((o) => (
              <TableRow key={o.id} className={cn(o.estado === "anulada" && "opacity-50")}>
                <TableCell className="tabular-nums text-muted-foreground">{o.numero}</TableCell>
                <TableCell>
                  <span className="font-medium">{o.producto}</span>
                  {o.estado === "anulada" && <span className="ml-2 text-xs text-destructive">anulada</span>}
                  <span className="block text-xs text-muted-foreground">{[formatoFechaHora(o.fecha), o.usuario, o.notas].filter(Boolean).join(" · ")}</span>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatoNumero(o.cantidad)}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatoPesos(o.costoUnitario)}</TableCell>
                <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{formatoPesos(o.costoMateriales)}</TableCell>
                <TableCell className="text-right">
                  {o.estado === "terminada" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={anularOrden.isPending}
                      onClick={() =>
                        window.confirm(`¿Anular la orden #${o.numero}? Vuelven los insumos y se descuentan los ${formatoNumero(o.cantidad)} fabricados.`) &&
                        anularOrden.mutate(o.id, { onSuccess: () => toast.success(`Orden #${o.numero} anulada`), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo anular") })
                      }
                    >
                      Anular
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Recetas() {
  const { data, isPending, isError, error, refetch } = useRecetas();
  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  if (data.length === 0) return <SinDatos mensaje="Todavía no hay recetas. Una receta dice qué insumos lleva cada producto que fabricás (o qué trae cada kit)." />;
  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Precio</TableHead>
              <TableHead className="text-right">Margen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/produccion/receta?productoId=${r.productoId}${r.varianteId ? `&varianteId=${r.varianteId}` : ""}`} className="font-medium hover:underline">
                    {r.nombre}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {r.armarAlVender ? "Kit · se arma al vender" : "Se fabrica"} · {r.componentes} {r.componentes === 1 ? "componente" : "componentes"}
                    {r.costo.sinCosto > 0 && <span className="text-amber-600 dark:text-amber-400"> · {r.costo.sinCosto} sin costo cargado</span>}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatoPesos(r.costo.total)}
                  {r.costo.manoObra > 0 && <span className="block text-xs text-muted-foreground">mano de obra {formatoPesos(r.costo.manoObra)}</span>}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.precio == null ? "—" : formatoPesos(r.precio)}</TableCell>
                <TableCell className={cn("text-right font-medium tabular-nums", r.margen != null && r.margen < 20 && "text-destructive")}>{r.margen == null ? "—" : `${r.margen}%`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
