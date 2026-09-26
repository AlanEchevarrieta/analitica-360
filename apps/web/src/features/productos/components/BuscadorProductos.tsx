"use client";

import { useMemo, useState } from "react";
import { Camera, Layers, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatoNumero, formatoPesos } from "@/lib/formato";
import { useApiFetch } from "@/hooks/use-api";
import { useProductos } from "../hooks/use-productos";
import { useVariantes } from "../hooks/use-variantes";
import { etiquetaVariante, type LineaProducto, type ProductoFila, type VarianteProducto } from "../types";
import { EscanerCamara } from "./EscanerCamara";
import { NuevaVarianteInline } from "./NuevaVarianteInline";

const MAX_RESULTADOS = 8;
const MAS_VENDIDOS = 8;

/**
 * Busca por nombre, código de barras o SKU (un lector de código escribe el
 * código y manda Enter: si coincide exacto se agrega directo; el SKU de una
 * variante agrega directo esa variante). Resultados y accesos
 * rápidos ordenados por demanda (más vendidos de los últimos 90 días primero).
 */
export function BuscadorProductos({
  onAgregar,
  precioDe = (producto, variante) => variante?.precioVenta ?? producto.precioVenta ?? 0,
  mostrar = "precio",
  permitirNuevaVariante = false,
}: {
  onAgregar: (linea: Omit<LineaProducto, "cantidad">) => void;
  /** Precio inicial de la línea: venta por defecto; en compras, el costo. */
  precioDe?: (producto: ProductoFila, variante: VarianteProducto | null) => number;
  /** Qué valor mostrar en los resultados de búsqueda. */
  mostrar?: "precio" | "costo";
  /** Compras: permite crear una variante que todavía no existe (ej. un color nuevo). */
  permitirNuevaVariante?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  // convertir = producto sin variantes al que se le van a crear (desde una compra).
  const [eligiendo, setEligiendo] = useState<{ producto: ProductoFila; variantes: VarianteProducto[]; convertir?: boolean } | null>(null);
  const api = useApiFetch();
  const [cargandoId, setCargandoId] = useState<string | null>(null);
  // Opcional: la cámara solo se abre si alguien toca "Escanear".
  const [camara, setCamara] = useState(false);
  const catalogo = useProductos({ pagina: 1, pageSize: 200, busqueda: "", estado: "activos", orden: "demanda" });
  const variantesDe = useVariantes();

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return (catalogo.data?.items ?? [])
      .filter((p) => p.nombre.toLowerCase().includes(q) || p.codigoBarra === busqueda.trim() || p.sku?.toLowerCase() === q)
      .slice(0, MAX_RESULTADOS);
  }, [busqueda, catalogo.data]);

  // El catálogo ya viene ordenado por demanda: los primeros son los más vendidos.
  const masVendidos = useMemo(
    () => (catalogo.data?.items ?? []).filter((p) => p.vendidos > 0).slice(0, MAS_VENDIDOS),
    [catalogo.data],
  );

  function agregar(producto: ProductoFila, variante: VarianteProducto | null) {
    onAgregar({
      clave: `${producto.id}:${variante?.id ?? ""}`,
      productoId: producto.id,
      varianteId: variante?.id ?? null,
      nombre: producto.nombre,
      variante: variante ? etiquetaVariante(variante.atributos) : null,
      precioUnitario: precioDe(producto, variante),
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

  /** Código exacto (barras o SKU de producto o variante): lo resuelve la API. */
  async function porCodigo(codigo: string): Promise<boolean> {
    try {
      const r = await api<{ productoId: string; varianteId: string | null }>(`/productos/por-codigo/${encodeURIComponent(codigo)}`);
      const producto = catalogo.data?.items.find((p) => p.id === r.productoId);
      if (!producto) return false;
      if (!r.varianteId) {
        void elegir(producto);
        return true;
      }
      const variante = (await variantesDe(producto.id)).find((v) => v.id === r.varianteId);
      if (variante) agregar(producto, variante);
      else void elegir(producto);
      return true;
    } catch {
      return false;
    }
  }

  async function onCodigoCamara(codigo: string) {
    if (!(await porCodigo(codigo))) toast.error(`El código ${codigo} no corresponde a ningún producto activo`);
  }

  async function onEnter() {
    const q = busqueda.trim();
    const exacto = catalogo.data?.items.find((p) => (p.codigoBarra && p.codigoBarra === q) || p.sku?.toLowerCase() === q.toLowerCase());
    if (exacto && !exacto.usaVariantes) return void elegir(exacto);
    // Puede ser el SKU de una variante (o un código que el catálogo local no tiene).
    if (q && (await porCodigo(q))) return;
    const unico = resultados.length === 1 ? resultados[0] : undefined;
    if (unico) void elegir(unico);
  }

  if (eligiendo) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          {eligiendo.convertir ? "Creá las variantes que llegaron de " : "Elegí la variante de "}
          <span className="font-medium">{eligiendo.producto.nombre}</span>
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
          {permitirNuevaVariante && (
            <NuevaVarianteInline
              productoId={eligiendo.producto.id}
              atributoSugerido={Object.keys(eligiendo.variantes[0]?.atributos ?? {})[0] ?? "Color"}
              abiertoInicial={eligiendo.convertir}
              onCreada={(v) => agregar(eligiendo.producto, v)}
              onCancelar={eligiendo.convertir ? () => setEligiendo(null) : undefined}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {camara && <EscanerCamara onCodigo={(c) => void onCodigoCamara(c)} onCerrar={() => setCamara(false)} />}
      <div className="flex gap-2">
        <div className="relative flex-1">
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
                void onEnter();
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
                  <li key={p.id} className="flex items-center">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => void elegir(p)}
                    >
                      <span className="truncate">{p.nombre}</span>
                      <span className="flex shrink-0 items-center gap-3 tabular-nums">
                        <span className={p.stock <= 0 ? "text-destructive" : "text-muted-foreground"}>
                          stock {formatoNumero(p.stock)}
                        </span>
                        <span className="font-medium">
                        {mostrar === "costo" ? `costo ${formatoPesos(p.costo)}` : formatoPesos(p.precioVenta)}
                      </span>
                        {cargandoId === p.id && <Loader2 className="size-4 animate-spin" aria-label="Cargando" />}
                      </span>
                    </button>
                    {permitirNuevaVariante && !p.usaVariantes && (
                      <button
                        type="button"
                        className="flex shrink-0 items-center gap-1 self-stretch border-l px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Llegó en distintos colores, talles…: crear variantes"
                        onClick={() => {
                          setBusqueda("");
                          setEligiendo({ producto: p, variantes: [], convertir: true });
                        }}
                      >
                        <Layers className="size-3.5" aria-hidden /> Con variantes
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        {!camara && (
          <Button variant="outline" onClick={() => setCamara(true)} disabled={catalogo.isPending}>
            <Camera aria-hidden /> Escanear
          </Button>
        )}
      </div>
      {masVendidos.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Más vendidos">
          {masVendidos.map((p) => (
            <div key={p.id} className="flex">
              <Button
                size="sm"
                variant="secondary"
                className={permitirNuevaVariante && !p.usaVariantes ? "rounded-r-none" : undefined}
                disabled={cargandoId === p.id}
                onClick={() => void elegir(p)}
                title={`${p.vendidos} vendidos en 90 días · stock ${p.stock}`}
              >
                {cargandoId === p.id && <Loader2 className="animate-spin" aria-hidden />}
                {p.nombre}
              </Button>
              {permitirNuevaVariante && !p.usaVariantes && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-l-none border-l border-background/40 px-2"
                  aria-label={`${p.nombre} con variantes`}
                  title="Llegó en distintos colores, talles…: crear variantes"
                  onClick={() => setEligiendo({ producto: p, variantes: [], convertir: true })}
                >
                  <Layers aria-hidden />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
