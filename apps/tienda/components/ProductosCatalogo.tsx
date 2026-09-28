"use client";

import { useMemo, useState } from "react";
import { FiltrosSidebar, type Filtros } from "@/components/FiltrosSidebar";
import { ProductCard } from "@/components/ProductCard";
import { type CategoriaId, type CategoriaTienda, type ProductoTienda } from "@/lib/productos";

type Orden = "vendidos" | "menor" | "mayor";

export function ProductosCatalogo({
  productos,
  categorias,
  categoriaInicial = "todos",
}: {
  productos: ProductoTienda[];
  categorias: CategoriaTienda[];
  categoriaInicial?: CategoriaId | "todos";
}) {
  const bounds = useMemo(() => {
    const precios = productos.map((p) => p.precio);
    const min = precios.length ? Math.min(...precios) : 0;
    const max = precios.length ? Math.max(...precios) : 0;
    return { min: Math.floor(min), max: Math.ceil(max || 1) };
  }, [productos]);

  const [filtros, setFiltros] = useState<Filtros>({
    categoria: categoriaInicial,
    precioMin: bounds.min,
    precioMax: bounds.max,
    soloStock: false,
  });
  const [orden, setOrden] = useState<Orden>("vendidos");
  const [drawer, setDrawer] = useState(false);

  const lista = useMemo(() => {
    const filtrados = productos.filter((p) => {
      if (filtros.categoria !== "todos" && p.categoriaTienda !== filtros.categoria) return false;
      if (p.precio < filtros.precioMin || p.precio > filtros.precioMax) return false;
      if (filtros.soloStock && p.stock <= 0) return false;
      return true;
    });
    filtrados.sort((a, b) => {
      if (orden === "menor") return a.precio - b.precio;
      if (orden === "mayor") return b.precio - a.precio;
      return b.vendidos - a.vendidos || a.nombre.localeCompare(b.nombre, "es");
    });
    return filtrados;
  }, [filtros, orden, productos]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl text-[var(--tinta)]">Productos</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-[var(--r-boton)] border border-[var(--marca-oscuro)]/20 px-4 py-2 text-sm md:hidden"
            onClick={() => setDrawer(true)}
          >
            Filtros
          </button>
          <label className="text-sm">
            Ordenar por{" "}
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              className="rounded-lg border border-[var(--marca-oscuro)]/20 bg-white px-2 py-1"
            >
              <option value="vendidos">Más vendidos</option>
              <option value="menor">Menor precio</option>
              <option value="mayor">Mayor precio</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <div className="hidden lg:block">
          <FiltrosSidebar categorias={categorias} filtros={filtros} onChange={setFiltros} bounds={bounds} />
        </div>
        <div>
          {lista.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--marca-oscuro)]/20 bg-white p-8 text-sm text-[var(--tinta)]/70">
              No hay productos para mostrar.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
              {lista.map((p) => (
                <ProductCard key={p.id} producto={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-[var(--tinta)]/40" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 h-full w-[min(100%,320px)] overflow-y-auto bg-[var(--crema)] p-5 shadow-2xl">
            <FiltrosSidebar categorias={categorias} filtros={filtros} onChange={setFiltros} bounds={bounds} onClose={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
