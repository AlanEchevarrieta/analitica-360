"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiFetch } from "@/hooks/use-api";
import { formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { useCategorias } from "../hooks/use-producto-editor";

interface Linea {
  productoId: string;
  varianteId: string | null;
  nombre: string;
  variante: string | null;
  costo: number | null;
  precioActual: number | null;
  precioNuevo: number | null;
  margenActual: number | null;
  margenNuevo: number | null;
  omitido: "sin_precio" | "sin_costo" | null;
}
interface Resultado {
  lineas: Linea[];
  cambian: number;
  omitidos: number;
  aplicado: boolean;
}
type Pedido = { categoriaId: string | null; modo: "porcentaje" | "margen"; valor: number; redondeo: number; confirmar: boolean };

const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";
const REDONDEOS = [
  { valor: 0, etiqueta: "Sin redondear" },
  { valor: 10, etiqueta: "A $10" },
  { valor: 50, etiqueta: "A $50" },
  { valor: 100, etiqueta: "A $100" },
  { valor: 500, etiqueta: "A $500" },
  { valor: 1000, etiqueta: "A $1.000" },
];
const pct = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("es-AR")}%`);

/** Actualizar muchos precios juntos: por porcentaje o llevando a un margen, con vista previa. */
export function PreciosMasivosVista() {
  const api = useApiFetch();
  const router = useRouter();
  const queryClient = useQueryClient();
  const categorias = useCategorias();
  const [categoriaId, setCategoriaId] = useState("");
  const [modo, setModo] = useState<"porcentaje" | "margen">("porcentaje");
  const [valor, setValor] = useState("");
  const [redondeo, setRedondeo] = useState(100);
  const [vista, setVista] = useState<{ pedido: Omit<Pedido, "confirmar">; resultado: Resultado } | null>(null);

  const ejecutar = useMutation({ mutationFn: (p: Pedido) => api<Resultado>("/productos/precios/masivo", { method: "POST", body: JSON.stringify(p) }) });
  const numero = Number(valor.replace(",", "."));
  const pedido = { categoriaId: categoriaId || null, modo, valor: numero, redondeo };

  function previsualizar() {
    if (!valor.trim() || !Number.isFinite(numero) || numero === 0) return toast.error(modo === "porcentaje" ? "Poné el porcentaje (ej. 8)." : "Poné el margen que querés (ej. 50).");
    ejecutar.mutate({ ...pedido, confirmar: false }, { onSuccess: (resultado) => setVista({ pedido, resultado }), onError: (e) => toast.error(e.message) });
  }

  function aplicar() {
    if (!vista) return;
    if (!window.confirm(`¿Actualizar el precio de ${vista.resultado.cambian} productos/variantes?`)) return;
    ejecutar.mutate(
      { ...vista.pedido, confirmar: true },
      {
        onSuccess: (r) => {
          toast.success(`Listo: ${r.cambian} precios actualizados`);
          for (const k of ["productos", "producto", "variantes"]) void queryClient.invalidateQueries({ queryKey: [k] });
          router.push("/productos");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  const cambiaron = JSON.stringify(vista?.pedido) !== JSON.stringify(pedido);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>¿Cómo querés actualizar?</CardTitle>
          <CardDescription>Primero ves cómo quedan los precios; no se cambia nada hasta que confirmás.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:max-w-2xl" role="radiogroup" aria-label="Forma de actualizar">
            {[
              { v: "porcentaje" as const, t: "Subir o bajar un porcentaje", d: "Ej. +8% por inflación" },
              { v: "margen" as const, t: "Llevar a un margen de ganancia", d: "Ej. que todos ganen el 50% del precio" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={modo === o.v}
                onClick={() => setModo(o.v)}
                className={cn("rounded-lg p-3 text-left text-sm ring-1 transition-colors hover:bg-muted", modo === o.v ? "ring-2 ring-primary" : "ring-foreground/10")}
              >
                <span className="block font-medium">{o.t}</span>
                <span className="block text-xs text-muted-foreground">{o.d}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pm-valor">{modo === "porcentaje" ? "Porcentaje (%)" : "Margen deseado (%)"}</Label>
              <Input id="pm-valor" className="w-32" inputMode="decimal" placeholder={modo === "porcentaje" ? "8" : "50"} value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pm-categoria">Productos</Label>
              <select id="pm-categoria" className={selectClase} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="">Todos los activos</option>
                {(categorias.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    Categoría {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pm-redondeo">Redondeo</Label>
              <select id="pm-redondeo" className={selectClase} value={redondeo} onChange={(e) => setRedondeo(Number(e.target.value))}>
                {REDONDEOS.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={previsualizar} disabled={ejecutar.isPending}>
              {ejecutar.isPending && !vista && <Loader2 className="animate-spin" aria-hidden />}
              Ver cómo quedan
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {modo === "porcentaje"
              ? "Usá un número negativo para bajar (ej. -10). El redondeo es siempre hacia arriba."
              : "Margen sobre el precio: con costo $8.000 y 50%, el precio queda en $16.000. Los productos sin costo cargado no se tocan."}
          </p>
        </CardContent>
      </Card>

      {vista && (
        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>
                {vista.resultado.cambian === 1 ? "1 precio cambia" : `${vista.resultado.cambian} precios cambian`}
                {vista.resultado.omitidos ? ` · ${vista.resultado.omitidos} ${vista.resultado.omitidos === 1 ? "queda" : "quedan"} igual` : ""}
              </CardTitle>
              <CardDescription>{cambiaron ? "Cambiaste las opciones: volvé a tocar “Ver cómo quedan”." : "Revisá y confirmá."}</CardDescription>
            </div>
            <Button onClick={aplicar} disabled={cambiaron || vista.resultado.cambian === 0 || ejecutar.isPending}>
              {ejecutar.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Aplicar a {vista.resultado.cambian}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Costo</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vista.resultado.lineas.map((l) => (
                  <TableRow key={`${l.productoId}-${l.varianteId ?? ""}`} className={cn(l.omitido && "opacity-60")}>
                    <TableCell>
                      <span className="font-medium">{l.nombre}</span>
                      {l.variante && <span className="text-muted-foreground"> · {l.variante}</span>}
                      {l.omitido && <span className="block text-xs text-muted-foreground">{l.omitido === "sin_costo" ? "Sin costo cargado: no cambia" : "Sin precio: no cambia"}</span>}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{l.costo == null ? "—" : formatoPesos(l.costo)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.precioNuevo != null && l.precioNuevo !== l.precioActual ? (
                        <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5">
                          <span className="text-muted-foreground line-through">{formatoPesos(l.precioActual)}</span>
                          <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                          <span className="font-medium">{formatoPesos(l.precioNuevo)}</span>
                        </span>
                      ) : (
                        formatoPesos(l.precioActual)
                      )}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", l.margenNuevo != null && l.margenNuevo < 20 && "text-destructive")}>
                      {l.margenNuevo != null && l.margenNuevo !== l.margenActual ? (
                        <>
                          <span className="hidden text-muted-foreground sm:inline">{pct(l.margenActual)} → </span>
                          {pct(l.margenNuevo)}
                        </>
                      ) : (
                        pct(l.margenActual)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Link href="/productos" className="self-start text-sm text-muted-foreground hover:text-foreground">
        ← Volver a productos
      </Link>
    </div>
  );
}
