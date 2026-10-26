"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type GuiaItem,
  type CategoriaGuia,
  TODAS_LAS_GUIAS,
} from "@/lib/guias/guias-db";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Share2,
  Check,
  BookOpen,
  Compass,
  Layers,
  Sparkles,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import {
  iniciarTourModulo,
  GUIA_A_TOUR_MAP,
  TOURS_MODULOS,
} from "@/lib/tour";

const CATEGORIA_COLOR: Record<CategoriaGuia, string> = {
  "Arranque y Configuración": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "Ventas y Cobranzas": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "Catálogo y Stock": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "Inteligencia y Finanzas": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  "Canales y Soporte": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
};

interface GuiaDetalleVistaProps {
  guia: GuiaItem;
  htmlContenido: string;
  anterior?: GuiaItem;
  siguiente?: GuiaItem;
}

export function GuiaDetalleVista({
  guia,
  htmlContenido,
  anterior,
  siguiente,
}: GuiaDetalleVistaProps) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);

  const idTour = GUIA_A_TOUR_MAP[guia.slug] || "general";
  const defTour = TOURS_MODULOS[idTour];

  const ejecutarTour = () => {
    if (defTour && defTour.ruta && defTour.ruta !== "/inicio") {
      router.push(`${defTour.ruta}?tour=1`);
    } else {
      iniciarTourModulo(idTour);
    }
  };

  const copiarEnlace = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      toast.success("Enlace de la guía copiado al portapapeles");
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  // Guías de la misma categoría para la barra lateral
  const relacionadas = TODAS_LAS_GUIAS.filter(
    (g) => g.categoria === guia.categoria && g.slug !== guia.slug
  ).slice(0, 5);

  return (
    <div className="space-y-6 pb-20">
      {/* Barra Superior de Navegación y Acciones */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/guias">
            <Button variant="outline" size="sm" className="gap-1.5 border-border hover:bg-muted cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
              <span>Volver a Guías</span>
            </Button>
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span>Guías</span>
            <span>/</span>
            <span>{guia.categoria}</span>
            <span>/</span>
            <span className="font-semibold text-foreground truncate max-w-[200px]">
              #{guia.id}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copiarEnlace}
            className="gap-1.5 border-border hover:bg-muted cursor-pointer"
          >
            {copiado ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Copiado</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>Compartir</span>
              </>
            )}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={ejecutarTour}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            <span>Paso a Paso en Pantalla (Driver.js)</span>
          </Button>
        </div>
      </div>

      {/* Contenedor Principal: 2 Columnas (Artículo + Sidebar de Navegación) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start min-w-0 max-w-full">
        {/* Columna Principal: Documento y Contenido */}
        <article className="lg:col-span-8 xl:col-span-9 space-y-6 min-w-0 max-w-full overflow-hidden">
          {/* Encabezado del Manual */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-muted text-foreground border border-border">
                MANUAL #{guia.id}
              </span>
              <span
                className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border ${
                  CATEGORIA_COLOR[guia.categoria]
                }`}
              >
                {guia.categoria}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                <Clock className="h-3.5 w-3.5" />
                {guia.tiempoLectura} de lectura
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-snug">
              {guia.titulo}
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {guia.resumen}
            </p>

            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
              {guia.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Cuerpo Markdown procesado con estilos .guia-prose */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-8 md:p-10 shadow-xs overflow-hidden min-w-0 max-w-full">
            <div
              className="guia-prose max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlContenido }}
            />
          </div>

          {/* Navegación Inferior: Guía Anterior y Siguiente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/60">
            {anterior ? (
              <Link
                href={`/guias/${anterior.slug}`}
                className="group flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/50 hover:bg-muted/30"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
                  <span>Manual Anterior (#{anterior.id})</span>
                </div>
                <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mt-1">
                  {anterior.titulo}
                </div>
              </Link>
            ) : (
              <div />
            )}

            {siguiente ? (
              <Link
                href={`/guias/${siguiente.slug}`}
                className="group flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 text-right transition-all hover:border-primary/50 hover:bg-muted/30"
              >
                <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-muted-foreground">
                  <span>Siguiente Manual (#{siguiente.id})</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mt-1">
                  {siguiente.titulo}
                </div>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </article>

        {/* Sidebar Lateral de Navegación Rápida */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-6 lg:sticky lg:top-20">
          {/* Card de Índice / Bóveda */}
          <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Compass className="h-4 w-4 text-primary" />
              <span>Navegación Rápida</span>
            </div>

            <div className="space-y-1.5">
              <Link
                href="/guias"
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Explorar todas las guías (26)</span>
              </Link>
              <Link
                href="/guias/indice-general"
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  guia.slug === "indice-general"
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Índice General (#00)</span>
              </Link>
            </div>
          </div>

          {/* Guías Relacionadas de la Misma Categoría */}
          {relacionadas.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3 shadow-xs">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                En esta categoría ({guia.categoria})
              </div>

              <div className="space-y-2">
                {relacionadas.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/guias/${r.slug}`}
                    className="block rounded-lg p-2 text-xs hover:bg-muted/60 transition-colors group"
                  >
                    <div className="font-mono text-[10px] text-muted-foreground group-hover:text-primary">
                      #{r.id} · {r.tiempoLectura}
                    </div>
                    <div className="font-semibold text-foreground group-hover:text-primary leading-tight line-clamp-2 mt-0.5">
                      {r.titulo}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Card de Asistencia con Analítica IA */}
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" />
              <span>¿Dudas con este módulo?</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Podés consultar en cualquier momento a **Analítica IA** para diagnosticar transacciones o resolver dudas operativas sobre este proceso.
            </p>
            <Link href="/ia" className="block">
              <Button size="sm" variant="outline" className="w-full text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer">
                <Sparkles className="h-3 w-3" />
                Abrir Analítica IA
              </Button>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
