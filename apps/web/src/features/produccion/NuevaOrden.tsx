"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SinDatos } from "@/components/shared/estado-datos";
import { useUbicaciones } from "@/features/ventas/hooks/use-nueva-venta";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { abreviaturaUnidad } from "@/lib/unidades";
import { cn } from "@/lib/utils";
import { useAccionesProduccion, usePreviaOrden, useRecetas } from "./hooks";

const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";

/** Registrar lo que se fabricó: descuenta insumos y suma el producto terminado. */
export function NuevaOrden() {
  const router = useRouter();
  const inicial = useSearchParams().get("productoId");
  const recetas = useRecetas();
  const fabricables = (recetas.data ?? []).filter((r) => !r.armarAlVender);
  const [clave, setClave] = useState<string>(() => (inicial ? `${inicial}:` : ""));
  const [cantidad, setCantidad] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [notas, setNotas] = useState("");
  const [igual, setIgual] = useState(false);
  const ubicaciones = useUbicaciones();
  const lugares = ubicaciones.data ?? [];
  const { crearOrden } = useAccionesProduccion();
  const [productoId, varianteId] = clave ? clave.split(":") : [null, null];
  const n = Number(cantidad.replace(",", "."));
  const cant = Number.isFinite(n) && n > 0 ? n : 0;
  const previa = usePreviaOrden(productoId || null, varianteId || null, cant);
  const elegida = fabricables.find((r) => `${r.productoId}:${r.varianteId ?? ""}` === clave);

  function confirmar() {
    if (!productoId || !cant) return toast.error("Elegí qué fabricaste y cuántos.");
    crearOrden.mutate(
      { productoId, varianteId: varianteId || null, cantidad: cant, ubicacion: lugares.length > 1 ? ubicacion || lugares[0].nombre : null, notas: notas.trim() || null, permitirFaltantes: igual },
      {
        onSuccess: (r) => {
          toast.success(`Orden #${r.numero}: ${formatoNumero(cant)} ${elegida?.nombre ?? ""} al stock${r.costoUnitario != null ? ` (costo ${formatoPesos(r.costoUnitario)} c/u)` : ""}`);
          router.push("/produccion");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
      },
    );
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/produccion" aria-label="Volver a producción" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-semibold">Fabricar</h1>
      </div>
      {recetas.data && fabricables.length === 0 ? (
        <SinDatos mensaje="Primero cargá la receta de lo que fabricás (Producción → Nueva receta)." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>¿Qué fabricaste?</CardTitle>
            <CardDescription>Se descuentan los insumos de la receta y se suma al stock con su costo real.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="orden-producto">Producto</Label>
                <select id="orden-producto" className={cn(selectClase, "min-w-60")} value={clave} onChange={(e) => (setClave(e.target.value), setIgual(false))}>
                  <option value="">Elegir…</option>
                  {fabricables.map((r) => (
                    <option key={r.id} value={`${r.productoId}:${r.varianteId ?? ""}`}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="orden-cantidad">Cantidad</Label>
                <Input id="orden-cantidad" className="w-28" inputMode="decimal" placeholder="Ej. 20" value={cantidad} onChange={(e) => (setCantidad(e.target.value), setIgual(false))} />
              </div>
              {lugares.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="orden-ubicacion">Dónde queda</Label>
                  <select id="orden-ubicacion" className={selectClase} value={ubicacion || lugares[0].nombre} onChange={(e) => setUbicacion(e.target.value)}>
                    {lugares.map((u) => (
                      <option key={u.id} value={u.nombre}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                <Label htmlFor="orden-notas">Notas (opcional)</Label>
                <Input id="orden-notas" placeholder="Ej. tanda de la mañana" value={notas} onChange={(e) => setNotas(e.target.value)} />
              </div>
            </div>

            {previa.data && cant > 0 && productoId && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insumo</TableHead>
                      <TableHead className="text-right">Usa</TableHead>
                      <TableHead className="text-right">Hay</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previa.data.lineas.map((l) => (
                      <TableRow key={`${l.insumoId}:${l.insumoVarianteId ?? ""}`}>
                        <TableCell>
                          {l.nombre}
                          {l.falta > 0 && (
                            <span className="block text-xs text-destructive">
                              Faltan {formatoNumero(l.falta)} {abreviaturaUnidad(l.unidad)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatoNumero(l.necesita)} {abreviaturaUnidad(l.unidad)}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", l.falta > 0 && "text-destructive")}>{formatoNumero(l.stock)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{l.costo == null ? "—" : formatoPesos(l.costo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {previa.data.costoMateriales != null && (
                <div className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                  <span>
                    Materiales: <b className="tabular-nums">{formatoPesos(previa.data.costoMateriales)}</b> · <b className="tabular-nums">{formatoPesos(previa.data.costoUnitario)}</b> c/u
                  </span>
                  {Boolean(previa.data.costoManoObra) && <span className="text-muted-foreground">Mano de obra: {formatoPesos(previa.data.costoManoObra)}</span>}
                </div>
                )}
                {previa.data.faltan > 0 && (
                  <div className="flex flex-col gap-2 rounded-lg bg-amber-500/10 p-3 text-sm ring-1 ring-amber-500/30">
                    <span className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="size-4 text-amber-500" aria-hidden /> Según el sistema no alcanzan los insumos.
                    </span>
                    <span className="text-muted-foreground">Si los tenés igual (por ejemplo, falta cargar una compra), podés confirmarlo: el stock de esos insumos va a quedar en negativo hasta que cargues la compra.</span>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={igual} onChange={(e) => setIgual(e.target.checked)} /> Fabricar igual
                    </label>
                  </div>
                )}
              </>
            )}
            <Button className="self-start" size="lg" onClick={confirmar} disabled={!cant || !productoId || crearOrden.isPending || (Boolean(previa.data?.faltan) && !igual)}>
              {crearOrden.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Confirmar fabricación
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
