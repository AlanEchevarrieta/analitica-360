"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoPesos } from "@/lib/formato";
import {
  useClientes,
  useConfiguracionVenta,
  useConfirmarVenta,
  useCrearCliente,
  useUbicaciones,
} from "../hooks/use-nueva-venta";
import type { LineaVenta } from "../types/nueva-venta";
import { BuscadorProductos } from "@/features/productos/components/BuscadorProductos";
import { LineasProductos } from "@/features/productos/components/LineasProductos";
import { etiquetaAjuste, precioConLista, useListasPrecios } from "@/features/listas-precios/listas-precios";
import { aNumero, calcularTotales, COBRO_INICIAL, CobroVenta, esClienteNuevo, type DatosCobro } from "./CobroVenta";

// Medio de pago y ubicación se recuerdan por dispositivo (localStorage): en
// un stand casi siempre se repiten, así no hay que elegirlos en cada venta.
const CLAVE_PREFERENCIAS = "a360-nueva-venta";

type Preferencias = Pick<DatosCobro, "formaPago" | "ubicacion">;
const SIN_PREFERENCIAS: Partial<Preferencias> = {};
let cache: { raw: string | null; valor: Partial<Preferencias> } = { raw: null, valor: SIN_PREFERENCIAS };

// Leído con useSyncExternalStore (snapshot estable, vacío en el servidor)
// para no romper la hidratación con valores que solo existen en el browser.
function leerPreferencias(): Partial<Preferencias> {
  try {
    const raw = localStorage.getItem(CLAVE_PREFERENCIAS);
    if (raw !== cache.raw) cache = { raw, valor: raw ? (JSON.parse(raw) as Partial<Preferencias>) : SIN_PREFERENCIAS };
    return cache.valor;
  } catch {
    return SIN_PREFERENCIAS;
  }
}
const sinSuscripcion = () => () => {};

/**
 * Línea del carrito: el precio sigue a la lista de precios elegida mientras
 * no se edite a mano (precioBase = precio normal del producto).
 */
type LineaCarrito = LineaVenta & { precioBase: number; precioEditado: boolean };

/** Estado inicial sin medio de pago ni ubicación: si no se eligen, valen las preferencias guardadas. */
const COBRO_VACIO: DatosCobro = { ...COBRO_INICIAL, formaPago: "", ubicacion: "" };

function recordar(cobro: DatosCobro) {
  try {
    localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify({ formaPago: cobro.formaPago, ubicacion: cobro.ubicacion }));
  } catch {
    /* sin storage: solo no se recuerda */
  }
}

export function NuevaVentaForm() {
  const router = useRouter();
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  // undefined = la lista la define el cliente elegido; null = precio normal a mano.
  const [listaElegida, setListaElegida] = useState<string | null | undefined>(undefined);
  const config = useConfiguracionVenta();
  const [eleccion, setCobro] = useState<DatosCobro>(COBRO_VACIO);
  const preferencias = useSyncExternalStore(sinSuscripcion, leerPreferencias, () => SIN_PREFERENCIAS);
  const cobro: DatosCobro = {
    ...eleccion,
    formaPago: eleccion.formaPago || preferencias.formaPago || COBRO_INICIAL.formaPago,
    // Elegida ahora > la última usada en este dispositivo > la default de la empresa.
    ubicacion: eleccion.ubicacion || preferencias.ubicacion || config.data?.ubicacionDefault || "",
  };
  const [error, setError] = useState<string | null>(null);
  const clientes = useClientes();
  const listas = useListasPrecios();
  const clienteElegido = clientes.data?.find((c) => c.nombre.toLowerCase() === cobro.cliente.trim().toLowerCase());
  const listaId = listaElegida !== undefined ? listaElegida : (clienteElegido?.listaPrecioId ?? null);
  const lista = listas.data?.find((l) => l.id === listaId) ?? null;
  const lineas: LineaCarrito[] = carrito.map((l) => (l.precioEditado ? l : { ...l, precioUnitario: precioConLista(l.precioBase, lista) }));
  const ubicaciones = useUbicaciones();
  const confirmar = useConfirmarVenta();
  const crearCliente = useCrearCliente();
  const enviando = confirmar.isPending || crearCliente.isPending;

  const subtotal = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0);
  const totales = calcularTotales(subtotal, cobro);
  const unidades = lineas.reduce((acc, l) => acc + l.cantidad, 0);

  function agregar(nueva: Omit<LineaVenta, "cantidad">) {
    setCarrito((prev) => {
      const existente = prev.find((l) => l.clave === nueva.clave);
      if (existente) return prev.map((l) => (l.clave === nueva.clave ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...prev, { ...nueva, cantidad: 1, precioBase: nueva.precioUnitario, precioEditado: false }];
    });
  }

  function validar(): string | null {
    if (lineas.length === 0) return "Agregá al menos un producto.";
    if (totales.total <= 0) return "El total tiene que ser mayor a $0.";
    if (config.data?.mostrarCliente === "siempre" && !cobro.cliente.trim()) return "Cargá el cliente (lo pide la configuración de ventas).";
    if (cobro.formaPago === "cuenta_corriente" && !cobro.cliente.trim()) return "Para vender a cuenta, elegí o cargá el cliente.";
    const senia = aNumero(cobro.montoSenia);
    if (cobro.esSenia && (senia <= 0 || senia >= totales.total)) {
      return "La seña tiene que ser mayor a $0 y menor que el total.";
    }
    return null;
  }

  async function registrar() {
    const problema = validar();
    setError(problema);
    if (problema) return;

    const lugares = ubicaciones.data ?? [];
    const nombreCliente = cobro.cliente.trim();
    try {
      let clienteId = clientes.data?.find((c) => c.nombre.toLowerCase() === nombreCliente.toLowerCase())?.id ?? null;
      if (config.data?.crearClienteDesdeVenta !== false && esClienteNuevo(nombreCliente, clientes.data ?? [])) {
        const nuevo = await crearCliente.mutateAsync({ nombre: nombreCliente, telefono: cobro.telefono.trim() || null });
        clienteId = nuevo.id;
      }

      const venta = await confirmar.mutateAsync({
        items: lineas.map((l) => ({
          productoId: l.productoId,
          varianteId: l.varianteId,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
        })),
        formaPago: cobro.formaPago,
        descuento: totales.descuento,
        clienteNombre: config.data?.mostrarCliente === "no_mostrar" ? null : nombreCliente || null,
        clienteId,
        listaPrecioId: lista?.id ?? null,
        cuotas: totales.cuotas,
        coeficienteInteres: cobro.formaPago === "credito" ? aNumero(cobro.interes) : 0,
        // Igual que el legacy: la ubicación solo se manda si hay más de una.
        ubicacionOrigen: lugares.length > 1 ? cobro.ubicacion || lugares[0].nombre : null,
        esSenia: cobro.esSenia,
        montoSenia: cobro.esSenia ? aNumero(cobro.montoSenia) : 0,
      });

      // Queda lista para la próxima venta, con el mismo medio de pago y ubicación.
      recordar(cobro);
      setCarrito([]);
      setListaElegida(undefined);
      setCobro({ ...COBRO_VACIO, formaPago: cobro.formaPago, ubicacion: cobro.ubicacion });
      toast.success(`Venta ${venta.numeroVenta ?? ""} registrada por ${formatoPesos(venta.total)}`, {
        action: { label: "Ver ventas", onClick: () => router.push("/ventas") },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la venta.");
    }
  }

  const botonRegistrar = (className?: string) => (
    <Button size="lg" className={className} onClick={() => void registrar()} disabled={enviando}>
      {enviando && <Loader2 className="animate-spin" aria-hidden />}
      Registrar venta
    </Button>
  );

  return (
    <div className="grid gap-4 pb-24 lg:grid-cols-[1fr_380px] lg:pb-0">
      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(listas.data?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor="venta-lista" className="text-muted-foreground">
                Precios:
              </label>
              <select
                id="venta-lista"
                className="h-8 rounded-lg border bg-transparent px-2"
                value={listaId ?? ""}
                onChange={(e) => {
                  setListaElegida(e.target.value || null);
                  // Al cambiar de lista, todos los precios vuelven a seguirla.
                  setCarrito((prev) => prev.map((l) => ({ ...l, precioEditado: false })));
                }}
              >
                <option value="">Precio normal</option>
                {listas.data!.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre} ({etiquetaAjuste(l.ajustePct)})
                  </option>
                ))}
              </select>
              {lista && listaElegida === undefined && clienteElegido && <span className="text-xs text-muted-foreground">Lista de {clienteElegido.nombre}</span>}
            </div>
          )}
          <BuscadorProductos onAgregar={agregar} />
          <LineasProductos
            lineas={lineas}
            onCambiar={(clave, cambios) =>
              setCarrito((prev) =>
                prev.map((l) => {
                  if (l.clave !== clave) return l;
                  // Precio escrito a mano: queda fijo aunque cambie la lista.
                  if (cambios.precioUnitario !== undefined) return { ...l, ...cambios, precioEditado: true };
                  return { ...l, ...cambios };
                }),
              )
            }
            onQuitar={(clave) => setCarrito((prev) => prev.filter((l) => l.clave !== clave))}
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
            config={config.data}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {botonRegistrar("hidden lg:inline-flex")}
        </CardContent>
      </Card>

      {/* Celular/tablet: total y botón siempre a mano, sin bajar hasta el cobro. */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">
            {unidades} {unidades === 1 ? "producto" : "productos"}
          </span>
          <span className="text-lg font-semibold tabular-nums">{formatoPesos(totales.total)}</span>
        </div>
        {botonRegistrar()}
      </div>
    </div>
  );
}
