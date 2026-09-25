"use client";

import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { useProductos } from "@/features/productos/hooks/use-productos";
import type { ProductoFila } from "@/features/productos/types";
import { useVariantes, type VarianteVenta } from "../hooks/use-nueva-venta";
import { etiquetaVariante, type LineaVenta } from "../types/nueva-venta";

const MAX_RESULTADOS = 8;

/**
 * Busca por nombre o código de barras (un lector de código escribe el código
 * y manda Enter: si coincide exacto se agrega directo).
 */
export function BuscadorProductos({ onAgregar }: { onAgregar: (linea: Omit<LineaVenta, "cantidad">) => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [eligiendo, setEligiendo] = useState<{ producto: ProductoFila; variantes: VarianteVenta[] } | null>(null);
  const [cargandoId, setCargandoId] = useState<string | null>(null);
  const catalogo = useProductos({ pagina: 1, pageSize: 200, busqueda: "", estado: "activos" });
  const variantesDe = useVariantes();

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return (catalogo.data?.items ?? [])
      .filter((p) => p.nombre.toLowerCase().includes(q) || p.codigoBarra === busqueda.trim())
      .slice(0, MAX_RESULTADOS);
  }, [busqueda, catalogo.data]);

  function agregar(producto: ProductoFila, variante: VarianteVenta | null) {
    onAgregar({
      clave: `${producto.id}:${variante?.id ?? ""}`,
      productoId: producto.id,
      varianteId: variante?.id ?? null,
      nombre: producto.nombre,
      variante: variante ? etiquetaVariante(variante.atributos) : null,
      precioUnitario: variante?.precioVenta ?? producto.precioVenta ?? 0,
      stock: producto.stock,
    });
    setBusqueda("");
    setEligiendo(null);
  }

  async function elegir(producto: ProductoFila) {
    setCargandoId(producto.id);
    try {
      const activas = (await variantesDe(producto.id)).filter((v) => v.activo);
      if (activas.length === 0) agregar(producto, null);
      else setEligiendo({ producto, variantes: activas });
    } catch {
      toast.error("No se pudieron cargar las variantes del producto");
    } finally {
      setCargandoId(null);
    }
  }

  function onEnter() {
    const exacto = catalogo.data?.items.find((p) => p.codigoBarra && p.codigoBarra === busqueda.trim());
    const unico = resultados.length === 1 ? resultados[0] : undefined;
    const producto = exacto ?? unico;
    if (producto) void elegir(producto);
  }

  if (eligiendo) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          Elegí la variante de <span className="font-medium">{eligiendo.producto.nombre}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {eligiendo.variantes.map((v) => (
            <Button key={v.id} variant="outline" onClick={() => agregar(eligiendo.producto, v)}>
              {etiquetaVariante(v.atributos) || v.sku || "Variante"}
            </Button>
          ))}
          <Button variant="ghost" onClick={() => setEligiendo(null)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden />
      <Input
        className="pl-8"
        placeholder={catalogo.isPending ? "Cargando productos…" : "Buscar producto o escanear código de barras"}
        aria-label="Buscar producto"
        value={busqueda}
        disabled={catalogo.isPending}
        onChange={(e) => setBusqueda(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        autoFocus
      />
      {busqueda.trim() && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {resultados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
          ) : (
            resultados.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => void elegir(p)}
                >
                  <span className="truncate">{p.nombre}</span>
                  <span className="flex shrink-0 items-center gap-3 tabular-nums">
                    <span className={p.stock <= 0 ? "text-destructive" : "text-muted-foreground"}>
                      stock {formatoNumero(p.stock)}
                    </span>
                    <span className="font-medium">{formatoPesos(p.precioVenta)}</span>
                    {cargandoId === p.id && <Loader2 className="size-4 animate-spin" aria-label="Cargando" />}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
