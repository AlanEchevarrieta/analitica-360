"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatoPesos } from "@/lib/formato";
import { BuscadorProductos } from "@/features/productos/components/BuscadorProductos";
import { LineasProductos } from "@/features/productos/components/LineasProductos";
import type { LineaProducto } from "@/features/productos/types";
import { aNumero } from "@/features/ventas/components/CobroVenta";
import { useUbicaciones } from "@/features/ventas/hooks/use-nueva-venta";
import { useConfirmarCompra, useProveedores } from "../hooks/use-compras";
import { ADICIONALES_VACIOS, CostosAdicionales, costoRealPorUnidad, type DatosAdicionales } from "./CostosAdicionales";

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NuevaCompraForm() {
  const router = useRouter();
  const [lineas, setLineas] = useState<LineaProducto[]>([]);
  const [proveedor, setProveedor] = useState("");
  const [fecha, setFecha] = useState(hoyLocal);
  const [ubicacion, setUbicacion] = useState("");
  const [notas, setNotas] = useState("");
  const [adicionales, setAdicionales] = useState<DatosAdicionales>(ADICIONALES_VACIOS);
  const [error, setError] = useState<string | null>(null);
  const proveedores = useProveedores();
  const ubicaciones = useUbicaciones();
  const confirmar = useConfirmarCompra();

  const items = lineas.map((l) => ({ cantidad: l.cantidad, costoUnitario: l.precioUnitario }));
  const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.costoUnitario, 0);
  const totalAdicionales = aNumero(adicionales.flete) + aNumero(adicionales.impuestos) + aNumero(adicionales.otros);
  const costosReales = costoRealPorUnidad(items, totalAdicionales);
  const listaUbicaciones = ubicaciones.data ?? [];

  function agregar(nueva: Omit<LineaProducto, "cantidad">) {
    setLineas((prev) => {
      const existente = prev.find((l) => l.clave === nueva.clave);
      if (existente) return prev.map((l) => (l.clave === nueva.clave ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...prev, { ...nueva, cantidad: 1 }];
    });
  }

  function registrar() {
    if (lineas.length === 0) return setError("Agregá al menos un producto.");
    if (!fecha) return setError("Elegí la fecha de la compra.");
    setError(null);

    const nombreProveedor = proveedor.trim();
    const existente = proveedores.data?.find((p) => p.nombre.toLowerCase() === nombreProveedor.toLowerCase());
    confirmar.mutate(
      {
        proveedorId: existente?.id ?? null,
        proveedorNombre: nombreProveedor || null,
        fecha,
        notas: notas.trim() || null,
        ubicacionDestino: listaUbicaciones.length > 1 ? ubicacion || listaUbicaciones[0].nombre : null,
        items: lineas.map((l) => ({
          productoId: l.productoId,
          productoNombre: l.variante ? `${l.nombre} (${l.variante})` : l.nombre,
          varianteId: l.varianteId,
          cantidad: l.cantidad,
          costoUnitario: l.precioUnitario,
        })),
        costosAdicionales: {
          flete: aNumero(adicionales.flete),
          impuestos: aNumero(adicionales.impuestos),
          otros: aNumero(adicionales.otros),
          descripcion: adicionales.descripcion.trim() || null,
        },
      },
      {
        onSuccess: (compra) => {
          toast.success(`Compra registrada por ${formatoPesos(compra.totalReal)}. Stock y costos actualizados.`);
          router.push("/compras");
        },
        onError: (e) => setError(e instanceof Error ? e.message : "No se pudo registrar la compra."),
      },
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Productos comprados</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <BuscadorProductos
              onAgregar={agregar}
              precioDe={(producto, variante) => variante?.costo ?? producto.costo ?? 0}
              mostrar="costo"
            />
            <LineasProductos
              lineas={lineas}
              etiquetaPrecio="Costo unitario"
              avisarStock={false}
              vacio="Buscá o escaneá los productos que llegaron."
              onCambiar={(clave, cambios) =>
                setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)))
              }
              onQuitar={(clave) => setLineas((prev) => prev.filter((l) => l.clave !== clave))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flete, impuestos y otros costos</CardTitle>
          </CardHeader>
          <CardContent>
            <CostosAdicionales datos={adicionales} onCambiar={(c) => setAdicionales((a) => ({ ...a, ...c }))} />
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Datos de la compra</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="compra-proveedor">Proveedor</Label>
            <Input
              id="compra-proveedor"
              list="proveedores-compra"
              placeholder="Nombre del proveedor"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
            />
            <datalist id="proveedores-compra">
              {(proveedores.data ?? []).map((p) => (
                <option key={p.id} value={p.nombre} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="compra-fecha">Fecha</Label>
              <Input id="compra-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            {listaUbicaciones.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="compra-ubicacion">Entra a</Label>
                <select
                  id="compra-ubicacion"
                  className="h-8 rounded-lg border bg-transparent px-2 text-sm"
                  value={ubicacion || listaUbicaciones[0].nombre}
                  onChange={(e) => setUbicacion(e.target.value)}
                >
                  {listaUbicaciones.map((u) => (
                    <option key={u.id} value={u.nombre}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="compra-notas">Notas</Label>
            <Input id="compra-notas" placeholder="N° de factura, observaciones…" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          <dl className="flex flex-col gap-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Mercadería</dt>
              <dd className="tabular-nums">{formatoPesos(subtotal)}</dd>
            </div>
            {totalAdicionales > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Flete, impuestos y otros</dt>
                <dd className="tabular-nums">{formatoPesos(totalAdicionales)}</dd>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold">
              <dt>Total real</dt>
              <dd className="tabular-nums">{formatoPesos(subtotal + totalAdicionales)}</dd>
            </div>
          </dl>

          {totalAdicionales > 0 && lineas.length > 0 && (
            <div className="flex flex-col gap-1 rounded-md bg-muted/50 p-3 text-xs">
              <p className="font-medium">Costo real por unidad</p>
              {lineas.map((l, i) => (
                <p key={l.clave} className="flex justify-between gap-2">
                  <span className="truncate">{l.variante ? `${l.nombre} (${l.variante})` : l.nombre}</span>
                  <span className="tabular-nums">{formatoPesos(costosReales[i])}</span>
                </p>
              ))}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button size="lg" onClick={registrar} disabled={confirmar.isPending}>
            {confirmar.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Registrar compra
          </Button>
          <p className="text-xs text-muted-foreground">
            Al registrar se suma el stock y se actualiza el costo de cada producto (costo promedio ponderado).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
