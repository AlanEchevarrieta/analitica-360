"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { BuscadorProductos } from "@/features/productos/components/BuscadorProductos";
import { useProductos } from "@/features/productos/hooks/use-productos";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { abreviaturaUnidad } from "@/lib/unidades";
import { cn } from "@/lib/utils";
import { useAccionesProduccion, useReceta, type RecetaDetalle } from "./hooks";

const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";
const aNum = (t: string) => Number(t.replace(",", "."));

/** Editor de la receta de un producto (o variante): componentes, minutos y si es un kit que se arma al vender. */
export function RecetaEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const productoId = params.get("productoId");
  const varianteId = params.get("varianteId");
  const detalle = useReceta(productoId, varianteId);
  const ir = (p: string | null, v: string | null) => router.replace(p ? `/produccion/receta?productoId=${p}${v ? `&varianteId=${v}` : ""}` : "/produccion/receta");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/produccion?tab=recetas" aria-label="Volver a producción" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-semibold">{detalle.data ? `Receta: ${detalle.data.producto.nombre}` : "Nueva receta"}</h1>
      </div>
      <ElegirProducto productoId={productoId} onElegir={(id) => ir(id, null)} />
      {productoId &&
        (detalle.isPending ? (
          <CargandoFilas filas={6} />
        ) : detalle.isError ? (
          <ErrorDatos error={detalle.error} onReintentar={() => detalle.refetch()} />
        ) : (
          <Formulario key={`${productoId}-${varianteId ?? ""}`} detalle={detalle.data} varianteId={varianteId} onVariante={(v) => ir(productoId, v)} />
        ))}
    </div>
  );
}

function ElegirProducto({ productoId, onElegir }: { productoId: string | null; onElegir: (id: string) => void }) {
  const productos = useProductos({ pagina: 1, pageSize: 200, busqueda: "", estado: "activos", orden: "nombre", tipo: "venta" });
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="receta-producto">Producto que fabricás o kit que armás</Label>
      <select id="receta-producto" className={cn(selectClase, "max-w-md")} value={productoId ?? ""} onChange={(e) => e.target.value && onElegir(e.target.value)}>
        <option value="">Elegir producto…</option>
        {(productos.data?.items ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
      {!productoId && <p className="text-xs text-muted-foreground">Si todavía no existe, crealo primero en Productos (con su precio de venta). Los insumos se cargan en Productos marcados como “insumo”.</p>}
    </div>
  );
}

interface Linea {
  clave: string;
  insumoId: string;
  insumoVarianteId: string | null;
  nombre: string;
  unidad: string;
  cantidad: string;
  costoUnitario: number | null;
  stock: number;
}

function Formulario({ detalle, varianteId, onVariante }: { detalle: RecetaDetalle; varianteId: string | null; onVariante: (v: string | null) => void }) {
  const router = useRouter();
  const { guardarReceta, eliminarReceta } = useAccionesProduccion();
  const [lineas, setLineas] = useState<Linea[]>(() =>
    detalle.items.map((i) => ({ clave: `${i.insumoId}:${i.insumoVarianteId ?? ""}`, insumoId: i.insumoId, insumoVarianteId: i.insumoVarianteId, nombre: i.nombre, unidad: i.unidad, cantidad: String(i.cantidad), costoUnitario: i.costoUnitario, stock: i.stock })),
  );
  const [minutos, setMinutos] = useState(detalle.receta ? String(detalle.receta.minutos) : "");
  const [armarAlVender, setArmarAlVender] = useState(detalle.receta?.armarAlVender ?? false);
  const [notas, setNotas] = useState(detalle.receta?.notas ?? "");

  const materiales = lineas.reduce((a, l) => a + (Number.isFinite(aNum(l.cantidad)) ? aNum(l.cantidad) : 0) * (l.costoUnitario ?? 0), 0);
  const manoObra = detalle.valorHora ? ((aNum(minutos) || 0) / 60) * detalle.valorHora : 0;
  const total = materiales + manoObra;
  const precio = detalle.producto.precio;
  const margen = precio ? Math.round(((precio - total) / precio) * 1000) / 10 : null;

  function guardar() {
    if (lineas.length === 0) return toast.error("Agregá al menos un componente.");
    const mal = lineas.find((l) => !(aNum(l.cantidad) > 0));
    if (mal) return toast.error(`Poné la cantidad de ${mal.nombre}.`);
    guardarReceta.mutate(
      {
        productoId: detalle.producto.id,
        varianteId,
        minutos: armarAlVender ? 0 : aNum(minutos) || 0,
        armarAlVender,
        notas: notas.trim() || null,
        items: lineas.map((l) => ({ insumoId: l.insumoId, insumoVarianteId: l.insumoVarianteId, cantidad: aNum(l.cantidad) })),
      },
      { onSuccess: () => (toast.success("Receta guardada"), router.push("/produccion?tab=recetas")), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar") },
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        {detalle.producto.variantes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="receta-variante">Variante</Label>
            <select id="receta-variante" className={cn(selectClase, "max-w-md")} value={varianteId ?? ""} onChange={(e) => onVariante(e.target.value || null)}>
              <option value="">Todas las variantes (misma receta)</option>
              {detalle.producto.variantes.map((v) => (
                <option key={v.id} value={v.id}>
                  Solo {v.etiqueta}
                </option>
              ))}
            </select>
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>¿Cómo se hace?</CardTitle>
            <CardDescription>Qué lleva una unidad. Para un kit, los productos que trae.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de receta">
              {[
                { v: false, t: "Lo fabrico", d: "Hacés una orden de producción y queda en stock." },
                { v: true, t: "Kit que se arma al vender", d: "No tiene stock propio: al venderlo se descuentan sus componentes." },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  role="radio"
                  aria-checked={armarAlVender === o.v}
                  onClick={() => setArmarAlVender(o.v)}
                  className={cn("rounded-lg p-3 text-left text-sm ring-1 hover:bg-muted", armarAlVender === o.v ? "ring-2 ring-primary" : "ring-foreground/10")}
                >
                  <span className="block font-medium">{o.t}</span>
                  <span className="block text-xs text-muted-foreground">{o.d}</span>
                </button>
              ))}
            </div>
            <BuscadorProductos
              tipo="todos"
              mostrar="costo"
              precioDe={(p, v) => v?.costo ?? p.costo ?? 0}
              onAgregar={(l) => {
                if (l.productoId === detalle.producto.id) return toast.error("Un producto no puede llevarse a sí mismo.");
                setLineas((prev) =>
                  prev.some((x) => x.clave === l.clave)
                    ? prev
                    : [...prev, { clave: l.clave, insumoId: l.productoId, insumoVarianteId: l.varianteId, nombre: l.variante ? `${l.nombre} · ${l.variante}` : l.nombre, unidad: l.unidad ?? "unidad", cantidad: "1", costoUnitario: l.precioUnitario || null, stock: l.stock }],
                );
              }}
            />
            {lineas.length > 0 && (
              <ul className="flex flex-col divide-y">
                {lineas.map((l) => {
                  const cant = aNum(l.cantidad);
                  return (
                    <li key={l.clave} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <span className="min-w-40 flex-1">
                        <span className="font-medium">{l.nombre}</span>
                        <span className="block text-xs text-muted-foreground">
                          {l.costoUnitario ? `${formatoPesos(l.costoUnitario)} por ${abreviaturaUnidad(l.unidad)}` : "Sin costo cargado"} · stock {formatoNumero(l.stock)} {abreviaturaUnidad(l.unidad)}
                        </span>
                      </span>
                      <Input
                        className="w-24 text-right"
                        inputMode="decimal"
                        aria-label={`Cantidad de ${l.nombre}`}
                        value={l.cantidad}
                        onChange={(e) => setLineas((prev) => prev.map((x) => (x.clave === l.clave ? { ...x, cantidad: e.target.value } : x)))}
                      />
                      <span className="w-8 text-muted-foreground">{abreviaturaUnidad(l.unidad)}</span>
                      <span className="w-24 text-right tabular-nums">{cant > 0 && l.costoUnitario ? formatoPesos(cant * l.costoUnitario) : "—"}</span>
                      <Button size="icon-sm" variant="ghost" aria-label={`Quitar ${l.nombre}`} onClick={() => setLineas((prev) => prev.filter((x) => x.clave !== l.clave))}>
                        <Trash2 />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            {!armarAlVender && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="receta-minutos">Minutos de trabajo por unidad</Label>
                  <Input id="receta-minutos" className="w-32" inputMode="decimal" placeholder="Ej. 20" value={minutos} onChange={(e) => setMinutos(e.target.value)} />
                </div>
                {!detalle.valorHora && (
                  <p className="pb-2 text-xs text-muted-foreground">
                    Para sumar la mano de obra, cargá el valor de la hora en{" "}
                    <Link href="/configuracion?s=produccion" className="underline">
                      Configuración → Producción
                    </Link>
                    .
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="receta-notas">Notas (opcional)</Label>
              <Input id="receta-notas" placeholder="Ej. pasos, proveedor del cuero…" value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Costo por unidad</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span>Materiales</span>
            <span className="tabular-nums">{formatoPesos(materiales)}</span>
          </div>
          {!armarAlVender && (
            <div className="flex justify-between">
              <span>Mano de obra</span>
              <span className="tabular-nums">{formatoPesos(manoObra)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Te cuesta</span>
            <span className="tabular-nums">{formatoPesos(total)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Lo vendés a</span>
            <span className="tabular-nums">{precio == null ? "sin precio" : formatoPesos(precio)}</span>
          </div>
          {margen != null && (
            <div className={cn("flex justify-between font-medium", margen < 20 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
              <span>Ganás</span>
              <span className="tabular-nums">
                {formatoPesos(precio! - total)} ({margen}%)
              </span>
            </div>
          )}
          {lineas.some((l) => !l.costoUnitario) && <p className="text-xs text-amber-600 dark:text-amber-400">Hay componentes sin costo: el costo real va a ser mayor. Se completa solo al cargar sus compras.</p>}
          <Button className="mt-2" onClick={guardar} disabled={guardarReceta.isPending}>
            {guardarReceta.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Guardar receta
          </Button>
          {detalle.receta && (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() =>
                window.confirm("¿Borrar esta receta? Las órdenes ya hechas no cambian.") &&
                eliminarReceta.mutate(detalle.receta!.id, { onSuccess: () => (toast.success("Receta borrada"), router.push("/produccion?tab=recetas")) })
              }
            >
              Borrar receta
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
