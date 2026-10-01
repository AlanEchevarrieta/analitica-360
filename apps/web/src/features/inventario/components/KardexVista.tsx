"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, PackageMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { SelectorPeriodo, useRangoFechas } from "@/components/shared/selector-periodo";
import { descargarCsv } from "@/lib/csv";
import { formatoFechaHora, formatoNumero, formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { useUbicaciones } from "@/features/ventas/hooks/use-nueva-venta";
import { etiquetaMovimiento, TIPOS_AJUSTE, useKardex, useRegistrarAjuste, type Kardex, type TipoAjuste } from "../hooks/use-kardex";
import { usePuedeExportar } from "@/hooks/use-suscripcion";

const POR_PAGINA = 100;
const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";

/** Kardex valorizado de un producto (PPP) + carga de mermas, roturas y recuentos. */
export function KardexVista({ productoId }: { productoId: string }) {
  const periodo = useRangoFechas("90dias");
  const [varianteId, setVarianteId] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState(false);
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const puedeExportar = usePuedeExportar();
  const { data: k, isPending, isError, error, refetch, isFetching } = useKardex(productoId, periodo.desde, periodo.hasta, varianteId);

  if (isPending) return <CargandoFilas filas={10} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;

  // Más nuevo arriba: es lo que se busca casi siempre.
  const filas = [...k.filas].reverse();
  const nombreVariante = k.variantes.find((v) => v.id === varianteId)?.etiqueta;

  function exportar() {
    descargarCsv(
      `kardex-${k!.producto.nombre}${nombreVariante ? `-${nombreVariante}` : ""}-${periodo.desde}-a-${periodo.hasta}`,
      k!.filas.map((f) => ({
        Fecha: formatoFechaHora(f.fecha),
        Movimiento: etiquetaMovimiento(f.tipo, f.entrada > 0),
        Variante: f.varianteEtiqueta ?? "",
        Comprobante: f.comprobante ?? "",
        Detalle: f.motivo ?? "",
        Usuario: f.usuario ?? "",
        Entrada: f.entrada || "",
        Salida: f.salida || "",
        "Costo unitario": f.costoUnitario,
        Valor: f.valor,
        "Saldo unidades": f.saldoCantidad,
        "Costo promedio": f.costoPromedio,
        "Saldo valorizado": f.saldoValor,
      })),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <Link href="/inventario" aria-label="Volver a inventario" className="mt-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{k.producto.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            Kardex valorizado · costo promedio ponderado{k.producto.sku ? ` · SKU ${k.producto.sku}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeExportar ? (
            <Button variant="outline" onClick={exportar} disabled={k.filas.length === 0}>
              <Download aria-hidden /> Exportar
            </Button>
          ) : null}
          <Button onClick={() => setAjustando((x) => !x)} aria-expanded={ajustando}>
            <PackageMinus aria-hidden /> Registrar merma o ajuste
          </Button>
        </div>
      </div>

      {ajustando && <FormAjuste kardex={k} varianteInicial={varianteId} onHecho={() => setAjustando(false)} />}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <SelectorPeriodo periodo={periodo} />
        {k.variantes.length > 0 && (
          <select aria-label="Variante" className={selectClase} value={varianteId ?? ""} onChange={(e) => (setVarianteId(e.target.value || null), setMostrar(POR_PAGINA))}>
            <option value="">Todas las variantes</option>
            {k.variantes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.etiqueta}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-5", isFetching && "opacity-60")}>
        <Resumen titulo="Stock al inicio" unidades={k.inicial.cantidad} valor={k.inicial.valor} />
        <Resumen titulo="Entradas" unidades={k.entradas.cantidad} valor={k.entradas.valor} signo="+" />
        <Resumen titulo="Salidas" unidades={k.salidas.cantidad} valor={k.salidas.valor} signo="−" />
        <Resumen titulo="Mermas y roturas" unidades={k.perdidas.cantidad} valor={k.perdidas.valor} signo="−" destacar={k.perdidas.valor > 0} ayuda="Ya incluidas en salidas. Restan en el estado de resultados." />
        <Resumen titulo="Stock al cierre" unidades={k.final.cantidad} valor={k.final.valor} ayuda={`Costo promedio ${formatoPesos(k.final.costoPromedio)}`} />
      </div>

      {k.producto.costo != null && k.final.costoPromedio > 0 && Math.abs(k.final.costoPromedio - k.producto.costo) / k.producto.costo > 0.01 && (
        <p className="text-sm text-muted-foreground">
          El costo cargado en el producto es {formatoPesos(k.producto.costo)} (el que usan las ventas y los resultados); el kardex, recalculando todas las compras, da {formatoPesos(k.final.costoPromedio)}. La diferencia viene de costos cargados a mano o del sistema anterior, y se achica sola con las próximas compras.
        </p>
      )}

      {Math.abs(k.diferenciaValuacion) >= 1 && (
        <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <b className="text-foreground">Diferencia por venta sin stock: {formatoPesos(k.diferenciaValuacion)}.</b> Hubo ventas cuando el stock estaba en negativo (se vendió antes de cargar la compra).
          Cuando entró la mercadería a otro costo, esas unidades se revaluaron. Por eso inicio + entradas − salidas no da exacto el cierre sin esta línea. Para evitarlo, cargá las compras antes de vender.
        </p>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3">
          {filas.length === 0 ? (
            <SinDatos mensaje="No hubo movimientos en este período." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                    <TableHead>Movimiento</TableHead>
                    <TableHead className="text-right sm:hidden">Cant.</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Entra</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Sale</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Costo unit.</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Valor</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Saldo $</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.slice(0, mostrar).map((f) => {
                    const entra = f.entrada > 0;
                    const perdida = ["merma", "rotura", "perdida", "consumo_interno"].includes(f.tipo);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">{formatoFechaHora(f.fecha)}</TableCell>
                        <TableCell>
                          <span className={cn("font-medium", perdida && "text-destructive")}>{etiquetaMovimiento(f.tipo, entra)}</span>
                          {f.varianteEtiqueta && <span className="text-muted-foreground"> · {f.varianteEtiqueta}</span>}
                          <span className="block text-xs text-muted-foreground tabular-nums sm:hidden">{formatoFechaHora(f.fecha)}</span>
                          <span className="block max-w-36 truncate text-xs text-muted-foreground sm:max-w-none sm:whitespace-normal">{[f.comprobante, f.motivo, f.usuario].filter(Boolean).join(" · ")}</span>
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums sm:hidden", entra && "text-emerald-600 dark:text-emerald-400")}>
                          {entra ? `+${formatoNumero(f.entrada)}` : `−${formatoNumero(f.salida)}`}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums text-emerald-600 sm:table-cell dark:text-emerald-400">{entra ? formatoNumero(f.entrada) : ""}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{entra ? "" : formatoNumero(f.salida)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{formatoPesos(f.costoUnitario)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{formatoPesos(f.valor)}</TableCell>
                        <TableCell className={cn("text-right font-medium tabular-nums", f.saldoCantidad < 0 && "text-destructive")}>{formatoNumero(f.saldoCantidad)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatoPesos(f.saldoValor)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  {Math.min(mostrar, filas.length)} de {filas.length} movimientos · el más nuevo arriba
                </span>
                {mostrar < filas.length && (
                  <Button size="sm" variant="outline" onClick={() => setMostrar((m) => m + POR_PAGINA)}>
                    Ver más
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Resumen({ titulo, unidades, valor, signo, ayuda, destacar }: { titulo: string; unidades: number; valor: number; signo?: string; ayuda?: string; destacar?: boolean }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className={cn("text-xl tabular-nums", destacar && "text-destructive")}>
          {signo && unidades ? `${signo} ` : ""}
          {formatoNumero(unidades)} u.
        </CardTitle>
        <p className="text-sm tabular-nums text-muted-foreground">{formatoPesos(valor)}</p>
        {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      </CardHeader>
    </Card>
  );
}

function FormAjuste({ kardex, varianteInicial, onHecho }: { kardex: Kardex; varianteInicial: string | null; onHecho: () => void }) {
  const registrar = useRegistrarAjuste();
  const ubicaciones = useUbicaciones();
  const lugares = ubicaciones.data ?? [];
  const [tipo, setTipo] = useState<TipoAjuste>("rotura");
  const [cantidad, setCantidad] = useState("");
  const [varianteId, setVarianteId] = useState(varianteInicial ?? "");
  const [ubicacion, setUbicacion] = useState("");
  const [motivo, setMotivo] = useState("");
  const n = Number(cantidad.replace(",", "."));
  const valido = Number.isFinite(n) && n > 0;
  const info = TIPOS_AJUSTE.find((t) => t.valor === tipo)!;
  const esPerdida = ["merma", "rotura", "perdida", "consumo_interno"].includes(tipo);

  function enviar() {
    if (!valido) return toast.error("Poné cuántas unidades.");
    if (kardex.variantes.length > 0 && !varianteId) return toast.error("Elegí la variante.");
    registrar.mutate(
      {
        productoId: kardex.producto.id,
        varianteId: varianteId || null,
        tipo,
        cantidad: n,
        motivo: motivo.trim() || null,
        ubicacion: lugares.length > 1 ? ubicacion || lugares[0].nombre : null,
      },
      {
        onSuccess: () => {
          toast.success(`${info.etiqueta} registrada: ${info.salida ? "−" : "+"}${formatoNumero(n)} u.`);
          onHecho();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar merma o ajuste de stock</CardTitle>
        <CardDescription>Mermas, roturas, pérdidas y consumo interno descuentan stock y cuentan como pérdida en el estado de resultados. Los recuentos solo corrigen el stock.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aj-tipo">Qué pasó</Label>
            <select id="aj-tipo" className={selectClase} value={tipo} onChange={(e) => setTipo(e.target.value as TipoAjuste)}>
              {TIPOS_AJUSTE.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aj-cantidad">Unidades</Label>
            <Input id="aj-cantidad" className="w-24" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          {kardex.variantes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aj-variante">Variante</Label>
              <select id="aj-variante" className={selectClase} value={varianteId} onChange={(e) => setVarianteId(e.target.value)}>
                <option value="">Elegir…</option>
                {kardex.variantes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.etiqueta}
                  </option>
                ))}
              </select>
            </div>
          )}
          {lugares.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aj-ubicacion">Dónde</Label>
              <select id="aj-ubicacion" className={selectClase} value={ubicacion || lugares[0].nombre} onChange={(e) => setUbicacion(e.target.value)}>
                {lugares.map((u) => (
                  <option key={u.id} value={u.nombre}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="aj-motivo">Detalle (opcional)</Label>
            <Input id="aj-motivo" placeholder="Ej. se cayó en el stand" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <Button onClick={enviar} disabled={registrar.isPending}>
            {registrar.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Registrar
          </Button>
        </div>
        {valido && esPerdida && (
          <p className="text-sm text-muted-foreground">
            Pérdida estimada: <b className="text-destructive">{formatoPesos(n * (kardex.producto.costo ?? kardex.final.costoPromedio))}</b> (a costo).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
