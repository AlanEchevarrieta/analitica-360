"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  TODAS_LAS_GUIAS,
  CATEGORIAS_GUIAS,
  type CategoriaGuia,
  type GuiaItem,
} from "@/lib/guias/guias-db";
import {
  BookOpen,
  Search,
  Clock,
  Sparkles,
  Compass,
  ArrowRight,
  HelpCircle,
  Tag,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { iniciarTourAnalitica360 } from "@/lib/tour";

const CATEGORIA_COLOR: Record<CategoriaGuia, string> = {
  "Arranque y Configuración": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "Ventas y Cobranzas": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "Catálogo y Stock": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "Inteligencia y Finanzas": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  "Canales y Soporte": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
};

export function GuiasHub() {
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState<string>("");

  const guiasFiltradas = useMemo(() => {
    let resultado = TODAS_LAS_GUIAS;

    if (categoriaSeleccionada !== "todas") {
      resultado = resultado.filter((g) => g.categoria === categoriaSeleccionada);
    }

    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      resultado = resultado.filter(
        (g) =>
          g.titulo.toLowerCase().includes(q) ||
          g.resumen.toLowerCase().includes(q) ||
          g.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return resultado;
  }, [categoriaSeleccionada, busqueda]);

  const conteoPorCategoria = useMemo(() => {
    const mapa: Record<string, number> = { todas: TODAS_LAS_GUIAS.length };
    for (const cat of CATEGORIAS_GUIAS) {
      mapa[cat] = TODAS_LAS_GUIAS.filter((g) => g.categoria === cat).length;
    }
    return mapa;
  }, []);

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Banner Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card/90 to-primary/5 p-6 sm:p-10 shadow-sm">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <BookOpen className="h-3.5 w-3.5" />
            Bóveda Operativa Analítica 360
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            Centro de Guías, Manuales y Procesos
          </h1>

          <p className="text-base text-muted-foreground leading-relaxed sm:text-lg">
            Documentación exhaustiva con casos de uso paso a paso, manuales de usuario, especificaciones técnicas y buenas prácticas para operar tu comercio con máxima eficiencia.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={() => iniciarTourAnalitica360()}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-sm cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              Iniciar Tour Interactivo
            </Button>
            <Link href="/guias/indice-general">
              <Button variant="outline" className="gap-2 border-border hover:bg-muted cursor-pointer">
                <Compass className="h-4 w-4" />
                Ver Índice General (#00)
              </Button>
            </Link>
          </div>
        </div>

        {/* Badges de Cobertura */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 border-t border-border/50 pt-6">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Manuales Completos
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">26</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Layers className="h-4 w-4 text-blue-500" />
              Módulos Cubiertos
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">5 Áreas</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Inteligencia Artificial
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">Analítica IA</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <HelpCircle className="h-4 w-4 text-cyan-500" />
              Soporte y FAQ
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">Integrado</div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por módulo, tema, #tag o palabra clave..."
              className="pl-9 bg-card border-border"
            />
          </div>

          <div className="text-sm text-muted-foreground">
            Mostrando <span className="font-semibold text-foreground">{guiasFiltradas.length}</span> de{" "}
            {TODAS_LAS_GUIAS.length} manuales
          </div>
        </div>

        {/* Píldoras de Categoría */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoriaSeleccionada("todas")}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border ${
              categoriaSeleccionada === "todas"
                ? "bg-foreground text-background border-foreground shadow-xs"
                : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            }`}
          >
            Todas las Guías ({conteoPorCategoria["todas"]})
          </button>
          {CATEGORIAS_GUIAS.map((cat) => {
            const activa = categoriaSeleccionada === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoriaSeleccionada(cat)}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border ${
                  activa
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat} ({conteoPorCategoria[cat] ?? 0})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de Manuales */}
      {guiasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <h3 className="text-base font-semibold text-foreground">No encontramos manuales para tu búsqueda</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Probá con otros términos como &quot;POS&quot;, &quot;facturación&quot;, &quot;inventario&quot; o &quot;clientes&quot;.
          </p>
          <Button variant="outline" size="sm" onClick={() => { setBusqueda(""); setCategoriaSeleccionada("todas"); }}>
            Restablecer filtros
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {guiasFiltradas.map((guia: GuiaItem) => (
            <Link
              key={guia.slug}
              href={`/guias/${guia.slug}`}
              className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-5 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md"
            >
              <div className="space-y-3">
                {/* Header Card: ID, Categoría y Tiempo */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-muted-foreground/80">
                    #{guia.id}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
                        CATEGORIA_COLOR[guia.categoria]
                      }`}
                    >
                      {guia.categoria}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                      <Clock className="h-3 w-3" />
                      {guia.tiempoLectura}
                    </span>
                  </div>
                </div>

                {/* Título */}
                <h2 className="text-base font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                  {guia.titulo}
                </h2>

                {/* Resumen */}
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {guia.resumen}
                </p>
              </div>

              {/* Footer: Tags y CTA */}
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-hidden">
                  <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-[11px] text-muted-foreground truncate">
                    {guia.tags.slice(0, 2).map((t) => `#${t}`).join(" ")}
                  </span>
                </div>

                <div className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0 group-hover:translate-x-1 transition-transform">
                  <span>Ver guía</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
