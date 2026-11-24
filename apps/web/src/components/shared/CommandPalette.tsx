"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ArrowRight, Lock, Search, X } from "lucide-react";
import { calcularModulosEfectivos } from "@analitica360/shared-types";
import { useEsAdmin } from "@/features/admin/hooks/use-admin";
import { useConfiguracion } from "@/features/configuracion/hooks/use-configuracion";
import { useAcceso } from "@/hooks/use-acceso";
import { usePlan } from "@/hooks/use-plan";
import { useRol } from "@/hooks/use-rol";
import {
  ACCIONES_RAPIDAS,
  GRUPOS_NAVEGACION,
  SUBRUTAS_BUSCADOR,
  type NavItem,
} from "@/lib/navegacion";
import { ACTIVIDADES_POR_DEFECTO } from "@/lib/rubros";
import { cn } from "@/lib/utils";

interface ResultadoPaleta {
  id: string;
  href: string;
  label: string;
  sublabel?: string;
  categoria: "Acción rápida" | "Pantalla";
  icon: NavItem["icon"];
  bloqueado: boolean;
  planNombre?: string;
}

/**
 * Paleta de comandos global (Ctrl+K / Cmd+K) para saltar a cualquier módulo,
 * subruta o acción rápida sin tener que recorrer todo el menú lateral.
 */
export function CommandPalette() {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [indiceActivo, setIndiceActivo] = useState(0);
  const listaRef = useRef<HTMLUListElement | null>(null);
  const router = useRouter();

  const { puede } = useAcceso();
  const plan = usePlan();
  const rol = useRol();
  const esAdmin = useEsAdmin().data?.admin === true;
  const configData = useConfiguracion().data;
  const actividades = configData?.actividades ?? ACTIVIDADES_POR_DEFECTO;
  const modulosEfectivos =
    configData?.modulosEfectivos ?? calcularModulosEfectivos(actividades, configData?.modulos);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const resultados = useMemo<ResultadoPaleta[]>(() => {
    const q = busqueda.trim().toLowerCase();

    const esVisible = (item: {
      href: string;
      modulo?: NavItem["modulo"];
      moduloId?: NavItem["moduloId"];
      para?: NavItem["para"];
    }) => {
      if (item.href === "/admin" && !esAdmin) return false;
      if (item.href === "/documentos" && rol !== "dueno" && rol !== "contador") return false;
      if (item.modulo && !puede(item.modulo)) return false;
      if (item.moduloId && modulosEfectivos[item.moduloId] === false) return false;
      if (item.para && !item.para.some((a) => actividades.includes(a))) return false;
      return true;
    };

    const lista: ResultadoPaleta[] = [];
    const vistos = new Set<string>();

    for (const acc of ACCIONES_RAPIDAS) {
      if (!esVisible(acc)) continue;
      const texto = `${acc.label} ${acc.descripcion} ${acc.keywords.join(" ")}`.toLowerCase();
      if (q && !texto.includes(q)) continue;
      const fn = acc.funcion ?? acc.modulo;
      const bloqueado = Boolean(fn) && !plan.incluye(fn!);
      lista.push({
        id: `acc-${acc.id}`,
        href: acc.href,
        label: acc.label,
        sublabel: acc.descripcion,
        categoria: "Acción rápida",
        icon: acc.icon,
        bloqueado,
        planNombre: bloqueado && fn ? plan.planMinimo(fn).nombre : undefined,
      });
    }

    const itemsPrincipales = GRUPOS_NAVEGACION.flatMap((g) => g.items);
    const todasPantallas = [...itemsPrincipales, ...SUBRUTAS_BUSCADOR];

    for (const item of todasPantallas) {
      if (vistos.has(item.href)) continue;
      vistos.add(item.href);
      if (!esVisible(item)) continue;
      const texto = `${item.label} ${item.href} ${(item.keywords ?? []).join(" ")}`.toLowerCase();
      if (q && !texto.includes(q)) continue;
      const fn = item.funcion ?? item.modulo;
      const bloqueado = Boolean(fn) && !plan.incluye(fn!);
      lista.push({
        id: `nav-${item.href}`,
        href: item.href,
        label: item.label,
        sublabel: item.href.split("?")[0],
        categoria: "Pantalla",
        icon: item.icon,
        bloqueado,
        planNombre: bloqueado && fn ? plan.planMinimo(fn).nombre : undefined,
      });
    }

    return lista.slice(0, 14);
  }, [busqueda, actividades, modulosEfectivos, esAdmin, rol, puede, plan]);

  const indiceSeguro = resultados.length > 0 ? Math.min(indiceActivo, resultados.length - 1) : 0;

  useEffect(() => {
    if (!abierto || !listaRef.current) return;
    const itemEl = listaRef.current.children[indiceSeguro] as HTMLElement | undefined;
    itemEl?.scrollIntoView({ block: "nearest" });
  }, [abierto, indiceSeguro]);

  const abrirPaleta = () => {
    setBusqueda("");
    setIndiceActivo(0);
    setAbierto(true);
  };

  const irA = (item: ResultadoPaleta) => {
    setAbierto(false);
    setBusqueda("");
    router.push(item.href);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (resultados.length > 0) setIndiceActivo((i) => (i + 1) % resultados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (resultados.length > 0) setIndiceActivo((i) => (i - 1 + resultados.length) % resultados.length);
    } else if (e.key === "Enter" && resultados[indiceSeguro]) {
      e.preventDefault();
      irA(resultados[indiceSeguro]);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={abrirPaleta}
        aria-label="Buscar secciones o acciones (Ctrl+K)"
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer sm:w-56 md:w-64"
      >
        <Search className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline truncate">Ir a sección o acción...</span>
        <span className="sm:hidden">Buscar</span>
        <kbd className="ml-auto hidden rounded border border-border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
          Ctrl K
        </kbd>
      </button>

      <DialogPrimitive.Root
        open={abierto}
        onOpenChange={(next) => {
          setAbierto(next);
          if (!next) {
            setBusqueda("");
            setIndiceActivo(0);
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <DialogPrimitive.Popup
            aria-label="Buscador rápido de navegación"
            className="fixed top-[12%] left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
          >
            <DialogPrimitive.Title className="sr-only">Navegación rápida</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Escribí el nombre de una pantalla o acción para navegar rápidamente.
            </DialogPrimitive.Description>

            <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-2.5">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                type="text"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setIndiceActivo(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Buscar pantalla, herramienta o acción (ej. caja, radar, nueva venta)..."
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => {
                    setBusqueda("");
                    setIndiceActivo(0);
                  }}
                  aria-label="Limpiar búsqueda"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-1.5">
              {resultados.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No encontramos secciones que coincidan con &ldquo;{busqueda}&rdquo;.
                </p>
              ) : (
                <ul ref={listaRef} role="listbox" aria-label="Resultados de navegación" className="flex flex-col gap-0.5">
                  {resultados.map((item, idx) => {
                    const Icono = item.icon;
                    const seleccionado = idx === indiceSeguro;
                    return (
                      <li key={item.id} role="option" aria-selected={seleccionado}>
                        <button
                          type="button"
                          onMouseEnter={() => setIndiceActivo(idx)}
                          onClick={() => irA(item)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                            seleccionado ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                            item.bloqueado && "opacity-75",
                          )}
                        >
                          <Icono className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">{item.label}</span>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {item.categoria}
                              </span>
                            </div>
                            {item.sublabel && (
                              <p className="truncate text-xs text-muted-foreground">{item.sublabel}</p>
                            )}
                          </div>
                          {item.bloqueado ? (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Lock className="size-3" aria-hidden />
                              {item.planNombre}
                            </span>
                          ) : (
                            <ArrowRight
                              className={cn(
                                "size-3.5 shrink-0 text-muted-foreground transition-opacity",
                                seleccionado ? "opacity-100" : "opacity-0",
                              )}
                              aria-hidden
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3.5 py-1.5 text-[11px] text-muted-foreground">
              <span>Usá las flechas para moverte y Enter para abrir</span>
              <span>Esc para cerrar</span>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
