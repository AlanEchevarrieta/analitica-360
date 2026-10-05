"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { aNumeroONull, aTexto } from "@/lib/numeros";
import {
  useAtributos,
  useGuardarProducto,
  useStockSinVariante,
  type ProductoDetalle,
  type VarianteDetalle,
} from "../hooks/use-producto-editor";
import { CampoCodigoBarra } from "./CampoCodigoBarra";
import { UNIDADES } from "@/lib/unidades";
import { CategoriaSelector } from "./CategoriaSelector";
import { FotosProducto } from "./FotosProducto";
import { OfertaProducto } from "./OfertaProducto";
import { usePlan } from "@/hooks/use-plan";
import { RepartoStock, repartoParaApi } from "./RepartoStock";
import { VariantesEditor, type VarianteEditable } from "./VariantesEditor";

function aEditable(v: VarianteDetalle): VarianteEditable {
  return {
    clave: v.id,
    id: v.id,
    pares: Object.entries(v.atributos).map(([atributo, valor]) => ({ atributo, valor })),
    sku: v.sku ?? "",
    precio: aTexto(v.precioVenta),
    costo: aTexto(v.costo),
    activo: v.activo,
    stock: v.stock,
  };
}

function aApi(v: VarianteEditable) {
  const atributos = Object.fromEntries(
    v.pares.filter((p) => p.atributo.trim() && p.valor.trim()).map((p) => [p.atributo.trim(), p.valor.trim()]),
  );
  return {
    ...(v.id ? { id: v.id } : {}),
    sku: v.sku.trim() || null,
    atributos,
    precioVenta: aNumeroONull(v.precio),
    costo: aNumeroONull(v.costo),
    activo: v.activo,
  };
}

export function ProductoForm({ inicial, variantesIniciales }: { inicial: ProductoDetalle | null; variantesIniciales: VarianteDetalle[] }) {
  const router = useRouter();
  const atributos = useAtributos();
  const guardar = useGuardarProducto();
  const plan = usePlan();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [categoriaId, setCategoriaId] = useState<string | null>(inicial?.categoriaId ?? null);
  const [precio, setPrecio] = useState(aTexto(inicial?.precioVenta));
  const [costo, setCosto] = useState(aTexto(inicial?.costo));
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [esInsumo, setEsInsumo] = useState(inicial?.esInsumo ?? false);
  const [unidad, setUnidad] = useState(inicial?.unidad ?? "unidad");
  const [enTienda, setEnTienda] = useState(inicial?.enTienda ?? true);
  const [codigo, setCodigo] = useState(inicial?.codigoBarra ?? "");
  const [sku, setSku] = useState(inicial?.sku ?? "");
  const sinVariante = useStockSinVariante(inicial?.id ?? null);
  const [reparto, setReparto] = useState<Record<string, string>>({});
  const [variantes, setVariantes] = useState<VarianteEditable[]>(() => variantesIniciales.map(aEditable));
  const [medidas, setMedidas] = useState({
    alto: aTexto(inicial?.altoCm),
    largo: aTexto(inicial?.largoCm),
    ancho: aTexto(inicial?.anchoCm),
    peso: aTexto(inicial?.pesoGr),
  });
  const [error, setError] = useState<string | null>(null);

  // Stock cargado sin variante: al guardar con variantes activas hay que repartirlo.
  const stockSuelto = sinVariante.data?.stock ?? 0;
  const variantesActivas = variantes
    .filter((v) => v.activo)
    .map((v) => ({ clave: v.clave, atributos: aApi(v).atributos }))
    .filter((v) => Object.keys(v.atributos).length > 0);
  const pideReparto = stockSuelto > 0 && variantesActivas.length > 0;
  // Con una sola variante, todo el stock va a esa (se puede cambiar igual).
  const repartoEfectivo =
    variantesActivas.length === 1 && reparto[variantesActivas[0].clave] === undefined ? { [variantesActivas[0].clave]: String(stockSuelto) } : reparto;
  const tieneVariantes = variantes.some((v) => v.activo);

  const precioN = aNumeroONull(precio);
  const costoN = aNumeroONull(costo);
  const margen = precioN && costoN != null ? Math.round(((precioN - costoN) / precioN) * 100) : null;

  function validar(): string | null {
    if (!nombre.trim()) return "El nombre es obligatorio.";
    const combos = new Set<string>();
    for (const v of variantes) {
      const a = aApi(v).atributos;
      if (Object.keys(a).length === 0) return "Cada variante necesita al menos un atributo con valor (ej. Color: Negro).";
      const combo = JSON.stringify(Object.entries(a).sort());
      if (combos.has(combo)) return `Hay dos variantes iguales: ${Object.values(a).join(" / ")}.`;
      combos.add(combo);
      if (!v.activo && v.stock !== 0) return `La variante ${Object.values(a).join(" / ")} tiene stock: no se puede desactivar.`;
    }
    if (pideReparto) {
      const asignado = repartoParaApi(variantesActivas, repartoEfectivo).reduce((acc, r) => acc + r.cantidad, 0);
      if (asignado !== stockSuelto) return `Repartí las ${stockSuelto} unidades sin variante entre las variantes (llevás ${asignado}).`;
    }
    return null;
  }

  function onGuardar() {
    const problema = validar();
    setError(problema);
    if (problema) return;
    const variantesApi = variantes.map(aApi);
    const variantesCambiaron = JSON.stringify(variantesApi) !== JSON.stringify(variantesIniciales.map((v) => aApi(aEditable(v))));
    const dimensiones = {
      altoCm: aNumeroONull(medidas.alto),
      largoCm: aNumeroONull(medidas.largo),
      anchoCm: aNumeroONull(medidas.ancho),
      pesoGr: aNumeroONull(medidas.peso),
    };
    const dimensionesAntes = { altoCm: inicial?.altoCm ?? null, largoCm: inicial?.largoCm ?? null, anchoCm: inicial?.anchoCm ?? null, pesoGr: inicial?.pesoGr ?? null };
    const codigoNuevo = codigo.trim() || null;
    const skuNuevo = sku.trim().toUpperCase() || null;

    guardar.mutate(
      {
        id: inicial?.id ?? null,
        datos: { nombre: nombre.trim(), categoriaId, precioVenta: precioN, costo: costoN, activo, esInsumo, unidad, enTienda },
        codigoBarra: codigoNuevo !== (inicial?.codigoBarra ?? null) ? codigoNuevo : undefined,
        sku: !tieneVariantes && skuNuevo && skuNuevo !== (inicial?.sku ?? null) ? skuNuevo : undefined,
        variantes: variantesCambiaron || pideReparto ? variantesApi : undefined,
        repartoSinVariante: pideReparto ? repartoParaApi(variantesActivas, repartoEfectivo) : undefined,
        dimensiones: JSON.stringify(dimensiones) !== JSON.stringify(dimensionesAntes) ? dimensiones : undefined,
      },
      {
        onSuccess: (p) => {
          toast.success(inicial ? "Producto guardado" : `Producto "${p.nombre}" creado`);
          router.push(inicial ? "/productos" : `/productos/${p.id}`);
        },
        onError: (e) => setError(e instanceof Error ? e.message : "No se pudo guardar el producto."),
      },
    );
  }

  const medida = (clave: keyof typeof medidas, etiqueta: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`producto-${clave}`}>{etiqueta}</Label>
      <Input id={`producto-${clave}`} inputMode="decimal" value={medidas[clave]} onChange={(e) => setMedidas((m) => ({ ...m, [clave]: e.target.value }))} />
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Datos del producto</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="producto-nombre">Nombre</Label>
              <Input id="producto-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus={!inicial} />
            </div>
            <CategoriaSelector valor={categoriaId} onCambiar={setCategoriaId} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="producto-precio">Precio de venta $</Label>
                <Input id="producto-precio" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="producto-costo">Costo $</Label>
                <Input id="producto-costo" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {margen != null ? `Margen: ${margen}%. ` : ""}El costo se actualiza solo con cada compra (costo promedio).
              Cambialo acá solo para corregirlo o cargar el inicial.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
              Activo (se puede vender)
            </label>
            {!esInsumo && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={enTienda} onChange={(e) => setEnTienda(e.target.checked)} />
                Mostrar en la tienda online
              </label>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-muted/40 p-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={esInsumo} onChange={(e) => setEsInsumo(e.target.checked)} />
                Es un insumo o materia prima (se usa para fabricar, no se vende)
              </label>
              <label className="flex items-center gap-2">
                Se mide en
                <select aria-label="Unidad de medida" className="h-8 rounded-lg border bg-transparent px-2" value={unidad} onChange={(e) => setUnidad(e.target.value)}>
                  {UNIDADES.map((u) => (
                    <option key={u.valor} value={u.valor}>
                      {u.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </CardContent>
        </Card>

        {inicial && !esInsumo && <FotosProducto productoId={inicial.id} />}
        {inicial && !esInsumo && enTienda && plan.incluye("tienda") && <OfertaProducto productoId={inicial.id} precioVenta={inicial.precioVenta} usaVariantes={inicial.usaVariantes} />}

        <Card>
          <CardHeader>
            <CardTitle>Variantes</CardTitle>
            <CardDescription>Colores, talles, materiales… cada combinación con su stock, precio y costo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <VariantesEditor variantes={variantes} onCambiar={setVariantes} atributos={atributos.data ?? []} />
            {pideReparto && (
              <RepartoStock
                total={stockSuelto}
                variantes={variantesActivas.map((v) => ({ clave: v.clave, etiqueta: Object.values(v.atributos).join(" / ") }))}
                cantidades={repartoEfectivo}
                onCambiar={setReparto}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Código y medidas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="producto-codigo">Código de barras</Label>
            <CampoCodigoBarra valor={codigo} onCambiar={setCodigo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="producto-sku">SKU (código interno)</Label>
            {tieneVariantes ? (
              <p className="text-sm text-muted-foreground">Cada variante tiene su propio SKU (lo ves en la lista de variantes).</p>
            ) : (
              <>
                <Input id="producto-sku" placeholder="Se genera solo al guardar" value={sku} onChange={(e) => setSku(e.target.value)} />
                <p className="text-xs text-muted-foreground">Podés dejar el automático o escribir el tuyo. Sirve para buscar y escanear.</p>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {medida("alto", "Alto cm")}
            {medida("largo", "Largo cm")}
            {medida("ancho", "Ancho cm")}
            {medida("peso", "Peso g")}
          </div>
          <p className="text-xs text-muted-foreground">Las medidas se usan para calcular envíos. Son opcionales.</p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button size="lg" onClick={onGuardar} disabled={guardar.isPending}>
            {guardar.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {inicial ? "Guardar cambios" : "Crear producto"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
