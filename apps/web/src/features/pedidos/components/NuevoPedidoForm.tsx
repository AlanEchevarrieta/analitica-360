"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiFetch } from "@/hooks/use-api";
import { formatoPesos } from "@/lib/formato";
import { BuscadorProductos } from "@/features/productos/components/BuscadorProductos";
import { LineasProductos } from "@/features/productos/components/LineasProductos";
import type { LineaProducto } from "@/features/productos/types";
import { useClientes } from "@/features/ventas/hooks/use-nueva-venta";

const PROVINCIAS = ["Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"];

type Datos = Record<"cliente" | "telefono" | "email" | "direccion" | "codigoPostal" | "localidad" | "provincia" | "envio" | "notas", string>;

const VACIO: Datos = { cliente: "", telefono: "", email: "", direccion: "", codigoPostal: "", localidad: "", provincia: "Mendoza", envio: "", notas: "" };

/** Pedido cargado a mano (WhatsApp, teléfono, Instagram…): mismo circuito que los de la tienda. */
export function NuevoPedidoForm() {
  const router = useRouter();
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const clientes = useClientes();
  const [lineas, setLineas] = useState<LineaProducto[]>([]);
  const [d, setD] = useState<Datos>(VACIO);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Datos, v: string) => setD((x) => ({ ...x, [k]: v }));
  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0);

  const crear = useMutation({
    mutationFn: (body: unknown) => api<{ id: string; numeroPedido: string }>("/pedidos", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pedidos"] }),
  });

  function elegirCliente(nombre: string) {
    const c = clientes.data?.find((x) => x.nombre.toLowerCase() === nombre.trim().toLowerCase());
    setD((x) => ({ ...x, cliente: nombre, telefono: x.telefono || c?.telefono || "" }));
  }

  function registrar() {
    if (lineas.length === 0) return setError("Agregá al menos un producto.");
    if (!d.cliente.trim()) return setError("Poné el nombre del cliente.");
    setError(null);
    const texto = (v: string) => v.trim() || null;
    const cliente = clientes.data?.find((x) => x.nombre.toLowerCase() === d.cliente.trim().toLowerCase());
    crear.mutate(
      {
        clienteId: cliente?.id ?? null,
        clienteNombre: d.cliente.trim(),
        clienteTelefono: texto(d.telefono),
        clienteEmail: texto(d.email),
        direccionEnvio: texto(d.direccion),
        codigoPostal: texto(d.codigoPostal),
        localidad: texto(d.localidad),
        provincia: texto(d.provincia),
        metodoEnvio: texto(d.envio),
        notas: texto(d.notas),
        items: lineas.map((l) => ({ productoId: l.productoId, varianteId: l.varianteId, cantidad: l.cantidad, precioUnitario: l.precioUnitario })),
      },
      {
        onSuccess: (p) => {
          toast.success(`Pedido ${p.numeroPedido} creado`);
          router.push(`/pedidos/${p.id}`);
        },
        onError: (e) => setError(e instanceof Error ? e.message : "No se pudo crear el pedido."),
      },
    );
  }

  const campo = (k: keyof Datos, etiqueta: string, extra?: Partial<React.ComponentProps<typeof Input>>) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`pedido-${k}`}>{etiqueta}</Label>
      <Input id={`pedido-${k}`} value={d[k]} onChange={(e) => set(k, e.target.value)} {...extra} />
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <BuscadorProductos
            onAgregar={(nueva) =>
              setLineas((prev) =>
                prev.some((l) => l.clave === nueva.clave)
                  ? prev.map((l) => (l.clave === nueva.clave ? { ...l, cantidad: l.cantidad + 1 } : l))
                  : [...prev, { ...nueva, cantidad: 1 }],
              )
            }
          />
          <LineasProductos
            lineas={lineas}
            vacio="Buscá los productos del pedido."
            onCambiar={(clave, c) => setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, ...c } : l)))}
            onQuitar={(clave) => setLineas((prev) => prev.filter((l) => l.clave !== clave))}
          />
        </CardContent>
      </Card>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Cliente y envío</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pedido-cliente">Cliente</Label>
            <Input id="pedido-cliente" list="pedido-clientes" value={d.cliente} onChange={(e) => elegirCliente(e.target.value)} />
            <datalist id="pedido-clientes">
              {(clientes.data ?? []).map((c) => (
                <option key={c.id} value={c.nombre} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {campo("telefono", "Teléfono", { inputMode: "tel" })}
            {campo("email", "Email", { type: "email" })}
          </div>
          {campo("direccion", "Dirección")}
          <div className="grid grid-cols-2 gap-3">
            {campo("localidad", "Localidad")}
            {campo("codigoPostal", "Código postal")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pedido-provincia">Provincia</Label>
            <select id="pedido-provincia" className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={d.provincia} onChange={(e) => set("provincia", e.target.value)}>
              {PROVINCIAS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          {campo("envio", "Envío", { placeholder: "Andreani, moto, retira en el local…" })}
          {campo("notas", "Notas", { placeholder: "Horario, referencias, regalo…" })}
          <p className="flex justify-between border-t pt-3 text-lg font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatoPesos(total)}</span>
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button size="lg" onClick={registrar} disabled={crear.isPending}>
            {crear.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Crear pedido
          </Button>
          <p className="text-xs text-muted-foreground">El stock se descuenta recién al despachar, cuando se registra la venta.</p>
        </CardContent>
      </Card>
    </div>
  );
}
