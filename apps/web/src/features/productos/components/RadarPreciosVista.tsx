"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Radar,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  SlidersHorizontal,
  Search,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoPesos } from "@/lib/formato";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import {
  useComparativasRadar,
  useEscanearLote,
  useEscanearProducto,
  useAlinearPrecio,
  type ResultadoBenchmarkProducto,
} from "../hooks/use-radar-precios";

type FiltroEstado = "todos" | "baratos" | "caros" | "alineados";

export function RadarPreciosVista() {
  const { data: benchmarks = [], isPending, isError, error, refetch, isFetching } = useComparativasRadar();
  const escanearLote = useEscanearLote();
  const escanearProd = useEscanearProducto();
  const alinearPrecio = useAlinearPrecio();

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [alineandoId, setAlineandoId] = useState<string | null>(null);

  // Métricas globales
  const total = benchmarks.length;
  const baratos = benchmarks.filter((b) => b.metricas.estadoCompetitivo === "barato_margen_recuperable");
  const caros = benchmarks.filter((b) => b.metricas.estadoCompetitivo === "caro_fuera_de_mercado");
  const alineados = benchmarks.filter((b) => b.metricas.estadoCompetitivo === "alineado");

  // Filtro
  const listaFiltrada = benchmarks.filter((b) => {
    if (filtroEstado === "baratos" && b.metricas.estadoCompetitivo !== "barato_margen_recuperable") return false;
    if (filtroEstado === "caros" && b.metricas.estadoCompetitivo !== "caro_fuera_de_mercado") return false;
    if (filtroEstado === "alineados" && b.metricas.estadoCompetitivo !== "alineado") return false;

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      const matchNombre = b.nombre.toLowerCase().includes(q);
      const matchEan = b.codigoBarra?.toLowerCase().includes(q);
      const matchSku = b.sku?.toLowerCase().includes(q);
      if (!matchNombre && !matchEan && !matchSku) return false;
    }
    return true;
  });

  const handleAlinear = async (producto: ResultadoBenchmarkProducto) => {
    const nuevo = producto.metricas.precioMediana;
    if (!nuevo || nuevo <= 0) return;
    try {
      setAlineandoId(producto.productoId);
      await alinearPrecio.mutateAsync({
        productoId: producto.productoId,
        nuevoPrecio: nuevo,
        motivo: `Alineado con mediana de mercado (${producto.fuentePrincipal})`,
      });
    } finally {
      setAlineandoId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Principal con Gradiente Futurista */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-background to-teal-950/30 p-6 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              Intelligence & Data Lakehouse
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Radar de Precios de Mercado</h2>
            <p className="text-sm text-muted-foreground">
              Rastreo continuo de precios en MercadoLibre y e-commerce con filtrado estadístico IQR para detectar
              oportunidades de margen y desfasajes frente a la calle.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5 border-border/60 hover:bg-muted"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={() => escanearLote.mutate({ limite: 15 })}
              disabled={escanearLote.isPending}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
            >
              <Radar className={`h-4 w-4 ${escanearLote.isPending ? "animate-spin text-emerald-200" : ""}`} />
              {escanearLote.isPending ? "Escaneando catálogo..." : "Escanear Lote Activo"}
            </Button>
          </div>
        </div>

        {/* Tarjetas KPI con Métricas Rápidas */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-border/50 bg-background/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="text-xs font-medium text-muted-foreground">Productos en Radar</div>
              <div className="mt-1 text-2xl font-bold tracking-tight">{total}</div>
              <div className="text-[11px] text-muted-foreground">monitoreados en Lakehouse</div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              filtroEstado === "baratos"
                ? "border-amber-500 bg-amber-950/20 shadow-md shadow-amber-500/10"
                : "border-border/50 bg-background/50 hover:border-amber-500/40"
            }`}
            onClick={() => setFiltroEstado((f) => (f === "baratos" ? "todos" : "baratos"))}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-400">Margen Regalado</span>
                <TrendingDown className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-1 text-2xl font-bold text-amber-400">{baratos.length}</div>
              <div className="text-[11px] text-muted-foreground">&gt;8% por debajo de mediana</div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              filtroEstado === "caros"
                ? "border-rose-500 bg-rose-950/20 shadow-md shadow-rose-500/10"
                : "border-border/50 bg-background/50 hover:border-rose-500/40"
            }`}
            onClick={() => setFiltroEstado((f) => (f === "caros" ? "todos" : "caros"))}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-rose-400">Fuera de Mercado</span>
                <TrendingUp className="h-4 w-4 text-rose-400" />
              </div>
              <div className="mt-1 text-2xl font-bold text-rose-400">{caros.length}</div>
              <div className="text-[11px] text-muted-foreground">&gt;8% por encima de mediana</div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              filtroEstado === "alineados"
                ? "border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-500/10"
                : "border-border/50 bg-background/50 hover:border-emerald-500/40"
            }`}
            onClick={() => setFiltroEstado((f) => (f === "alineados" ? "todos" : "alineados"))}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-400">Alineados</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-400">{alineados.length}</div>
              <div className="text-[11px] text-muted-foreground">rango competitivo ±8%</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabla con Filtros y Acciones */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Filtrar por nombre, código de barras o SKU..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={filtroEstado === "todos" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFiltroEstado("todos")}
              >
                Todos ({benchmarks.length})
              </Button>
              <Button
                variant={filtroEstado === "baratos" ? "secondary" : "ghost"}
                size="sm"
                className="text-amber-400"
                onClick={() => setFiltroEstado("baratos")}
              >
                Margen Regalado ({baratos.length})
              </Button>
              <Button
                variant={filtroEstado === "caros" ? "secondary" : "ghost"}
                size="sm"
                className="text-rose-400"
                onClick={() => setFiltroEstado("caros")}
              >
                Fuera de Mercado ({caros.length})
              </Button>
              <Button
                variant={filtroEstado === "alineados" ? "secondary" : "ghost"}
                size="sm"
                className="text-emerald-400"
                onClick={() => setFiltroEstado("alineados")}
              >
                Alineados ({alineados.length})
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isPending ? (
            <CargandoFilas filas={6} />
          ) : isError ? (
            <ErrorDatos error={error} onReintentar={() => refetch()} />
          ) : listaFiltrada.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Radar className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="text-lg font-semibold">No hay benchmarks en esta vista</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-1">
                {benchmarks.length === 0
                  ? "Aún no se han escaneado productos contra el mercado. Presioná 'Escanear Lote Activo' para comenzar."
                  : "No hay productos que coincidan con los filtros seleccionados."}
              </p>
              {benchmarks.length === 0 && (
                <Button
                  size="sm"
                  onClick={() => escanearLote.mutate({ limite: 15 })}
                  disabled={escanearLote.isPending}
                  className="mt-4 gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <Radar className="h-4 w-4" /> Escanear Catálogo Ahora
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Tu Precio</TableHead>
                    <TableHead className="text-center">Rango de Mercado (Mín / Mediana / Máx)</TableHead>
                    <TableHead className="text-center">Brecha vs Mercado</TableHead>
                    <TableHead>Mercado Libre y Referencias</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaFiltrada.map((item) => {
                    const brecha = item.metricas.brechaPorcentaje;
                    const esBarato = item.metricas.estadoCompetitivo === "barato_margen_recuperable";
                    const esCaro = item.metricas.estadoCompetitivo === "caro_fuera_de_mercado";
                    const esAlineado = item.metricas.estadoCompetitivo === "alineado";
                    const tieneMuestra = item.metricas.muestraFiltrada > 0;
                    const queryLimpia = (item.nombre || item.codigoBarra || "").replace(/[#,/\\_()\-]/g, " ").replace(/\s+/g, " ").trim();
                    const urlML =
                      item.urlBusquedaMercado ||
                      item.metricas.items.find((i) => i.url)?.url ||
                      `https://listado.mercadolibre.com.ar/${encodeURIComponent(queryLimpia.replace(/\s+/g, "-"))}`;

                    return (
                      <TableRow key={item.productoId} className="group hover:bg-muted/40 transition-colors">
                        <TableCell className="font-medium max-w-[260px]">
                          <div className="truncate font-semibold">{item.nombre}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {item.codigoBarra && (
                              <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                                EAN: {item.codigoBarra}
                              </span>
                            )}
                            {item.sku && <span>SKU: {item.sku}</span>}
                          </div>
                        </TableCell>

                        <TableCell className="text-right font-mono font-semibold">
                          <div>{formatoPesos(item.precioLocal)}</div>
                          {item.costoLocal && (
                            <div className="text-[11px] text-muted-foreground font-normal">
                              Costo: {formatoPesos(item.costoLocal)}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-center min-w-[220px]">
                          {tieneMuestra ? (
                            <>
                              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground px-1">
                                <span>{formatoPesos(item.metricas.precioMinimo)}</span>
                                <span className="font-bold text-foreground bg-muted/80 px-2 py-0.5 rounded">
                                  {formatoPesos(item.metricas.precioMediana)}
                                </span>
                                <span>{formatoPesos(item.metricas.precioMaximo)}</span>
                              </div>
                              {/* Barra visual de rango */}
                              <div className="relative mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    esBarato ? "bg-amber-400" : esCaro ? "bg-rose-500" : "bg-emerald-500"
                                  }`}
                                  style={{ width: "100%" }}
                                />
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-1">
                                Basado en {item.metricas.muestraFiltrada} publicaciones verificadas
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-1 text-center">
                              <span className="text-xs font-medium text-muted-foreground">Sin muestra en API</span>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Cotejar con enlace directo
                              </div>
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {tieneMuestra ? (
                            <>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  esBarato
                                    ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                                    : esCaro
                                    ? "border border-rose-500/30 bg-rose-500/10 text-rose-400"
                                    : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                }`}
                              >
                                {esBarato && <TrendingDown className="h-3.5 w-3.5" />}
                                {esCaro && <TrendingUp className="h-3.5 w-3.5" />}
                                {esAlineado && <CheckCircle2 className="h-3.5 w-3.5" />}
                                {brecha > 0 ? `+${brecha}%` : `${brecha}%`}
                              </span>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {esBarato
                                  ? "Margen recuperable"
                                  : esCaro
                                  ? "Riesgo de venta"
                                  : "Competitivo"}
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                0%
                              </span>
                              <div className="text-[10px] text-muted-foreground mt-0.5">Sin desfasaje verificado</div>
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="max-w-[260px]">
                          <div className="flex flex-col gap-1.5">
                            {/* Botón directo a Mercado Libre */}
                            <a
                              href={urlML}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 transition-colors w-fit shadow-2xs"
                              title={`Abrir búsqueda de "${item.nombre}" en MercadoLibre`}
                            >
                              <span>Ver en MercadoLibre</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>

                            {/* Publicaciones individuales con precio */}
                            {item.metricas.items
                              .filter((ref) => ref.precio > 0)
                              .slice(0, 2)
                              .map((ref, idx) => (
                                <a
                                  key={idx}
                                  href={ref.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group/link flex items-center justify-between text-xs text-muted-foreground hover:text-emerald-400 transition-colors truncate"
                                  title={`${ref.titulo} - ${formatoPesos(ref.precio)}`}
                                >
                                  <span className="truncate max-w-[170px]">{ref.titulo}</span>
                                  <span className="font-mono text-[11px] font-semibold text-foreground ml-1">
                                    {formatoPesos(ref.precio)}
                                  </span>
                                  <ExternalLink className="h-3 w-3 ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                </a>
                              ))}
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Re-escanear este producto"
                              disabled={escanearProd.isPending}
                              onClick={() => escanearProd.mutate(item.productoId)}
                            >
                              <RefreshCw
                                className={`h-3.5 w-3.5 ${
                                  escanearProd.isPending && escanearProd.variables === item.productoId
                                    ? "animate-spin text-emerald-400"
                                    : ""
                                }`}
                              />
                            </Button>

                            <Button
                              size="sm"
                              variant={esBarato ? "default" : "outline"}
                              className={`h-8 text-xs font-semibold ${
                                esBarato ? "bg-amber-600 hover:bg-amber-500 text-white" : ""
                              }`}
                              disabled={
                                alineandoId === item.productoId ||
                                !tieneMuestra ||
                                item.precioLocal === item.metricas.precioMediana
                              }
                              title={
                                !tieneMuestra
                                  ? "Requiere publicaciones verificadas en API para alinear"
                                  : undefined
                              }
                              onClick={() => handleAlinear(item)}
                            >
                              {alineandoId === item.productoId ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Alinear"
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
