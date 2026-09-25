"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoPesos } from "@/lib/formato";
import { useClientes, useConfirmarVenta, useUbicaciones } from "../hooks/use-nueva-venta";
import type { LineaVenta } from "../types/nueva-venta";
import { BuscadorProductos } from "./BuscadorProductos";
import { LineasVenta } from "./LineasVenta";
import { aNumero, calcularTotales, COBRO_INICIAL, CobroVenta, type DatosCobro } from "./CobroVenta";

export function NuevaVentaForm() {
  const router = useRouter();
  const [lineas, setLineas] = useState<LineaVenta[]>([]);
  const [cobro, setCobro] = useState<DatosCobro>(COBRO_INICIAL);
  const [error, setError] = useState<string | null>(null);
  const clientes = useClientes();
  const ubicaciones = useUbicaciones();
  const confirmar = useConfirmarVenta();

  const subtotal = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0);
  const totales = calcularTotales(subtotal, cobro);

  function agregar(nueva: Omit<LineaVenta, "cantidad">) {
    setLineas((prev) => {
      const existente = prev.find((l) => l.clave === nueva.clave);
      if (existente) return prev.map((l) => (l.clave === nueva.clave ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...prev, { ...nueva, cantidad: 1 }];
    });
  }

  function validar(): string | null {
    if (lineas.length === 0) return "Agregá al menos un producto.";
    if (totales.total <= 0) return "El total tiene que ser mayor a $0.";
    const senia = aNumero(cobro.montoSenia);
    if (cobro.esSenia && (senia <= 0 || senia >= totales.total)) {
      return "La seña tiene que ser mayor a $0 y menor que el total.";
    }
    return null;
  }

  function registrar() {
    const problema = validar();
    setError(problema);
    if (problema) return;

    const nombreCliente = cobro.cliente.trim();
    const cliente = clientes.data?.find((c) => c.nombre.toLowerCase() === nombreCliente.toLowerCase());
    const lista = ubicaciones.data ?? [];

    confirmar.mutate(
      {
        items: lineas.map((l) => ({
          productoId: l.productoId,
          varianteId: l.varianteId,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
        })),
        formaPago: cobro.formaPago,
        descuento: totales.descuento,
        clienteNombre: nombreCliente || null,
        clienteId: cliente?.id ?? null,
        cuotas: totales.cuotas,
        coeficienteInteres: cobro.formaPago === "credito" ? aNumero(cobro.interes) : 0,
        // Igual que el legacy: la ubicación solo se manda si hay más de una.
        ubicacionOrigen: lista.length > 1 ? cobro.ubicacion || lista[0].nombre : null,
        esSenia: cobro.esSenia,
        montoSenia: cobro.esSenia ? aNumero(cobro.montoSenia) : 0,
      },
      {
        onSuccess: (venta) => {
          toast.success(`Venta ${venta.numeroVenta ?? ""} registrada por ${formatoPesos(venta.total)}`);
          router.push("/ventas");
        },
        onError: (e) => setError(e instanceof Error ? e.message : "No se pudo registrar la venta."),
      },
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <BuscadorProductos onAgregar={agregar} />
          <LineasVenta
            lineas={lineas}
            onCambiar={(clave, cambios) =>
              setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)))
            }
            onQuitar={(clave) => setLineas((prev) => prev.filter((l) => l.clave !== clave))}
          />
        </CardContent>
      </Card>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Cobro</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CobroVenta
            cobro={cobro}
            onCambiar={(cambios) => setCobro((c) => ({ ...c, ...cambios }))}
            subtotal={subtotal}
            clientes={clientes.data ?? []}
            ubicaciones={ubicaciones.data ?? []}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button size="lg" onClick={registrar} disabled={confirmar.isPending}>
            {confirmar.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Registrar venta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
