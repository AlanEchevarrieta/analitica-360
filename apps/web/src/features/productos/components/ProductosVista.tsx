"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, Package, Percent, Plus, Radar } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductosListado } from "./ProductosListado";
import { RadarPreciosVista } from "./RadarPreciosVista";

export function ProductosVista() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "radar" ? "radar" : "catalogo";

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera principal con acciones según pestaña activa */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tab === "radar"
              ? "Monitoreo continuo de precios de mercado, desfasajes y benchmarking frente a la competencia."
              : "Gestión integral de catálogo, stock, listas de precios y variantes de tus productos."}
          </p>
        </div>

        {tab === "catalogo" && (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/productos/importar" className={buttonVariants({ variant: "outline" })}>
              <FileSpreadsheet aria-hidden className="h-4 w-4 mr-1 text-muted-foreground" />
              Importar Excel
            </Link>
            <Link href="/productos/precios" className={buttonVariants({ variant: "outline" })}>
              <Percent aria-hidden className="h-4 w-4 mr-1 text-muted-foreground" />
              Actualizar precios
            </Link>
            <Link href="/productos/nuevo" className={buttonVariants()}>
              <Plus aria-hidden className="h-4 w-4 mr-1" />
              Nuevo producto
            </Link>
          </div>
        )}
      </div>

      {/* Selector de Pestañas accesible */}
      <div role="tablist" aria-label="Secciones de productos" className="flex items-center gap-2 border-b border-border/60">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "catalogo"}
          onClick={() => router.replace("/productos")}
          className={cn(
            "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "catalogo"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <Package className="h-4 w-4" />
          <span>Catálogo de Productos</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === "radar"}
          onClick={() => router.replace("/productos?tab=radar")}
          className={cn(
            "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "radar"
              ? "border-emerald-500 text-emerald-400 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <Radar className={cn("h-4 w-4", tab === "radar" ? "text-emerald-400" : "text-muted-foreground")} />
          <span>Radar de Precios</span>
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
            Data Lake
          </span>
        </button>
      </div>

      {/* Contenido de la pestaña activa */}
      <div role="tabpanel" className="min-h-[400px]">
        {tab === "radar" ? <RadarPreciosVista /> : <ProductosListado />}
      </div>
    </div>
  );
}
