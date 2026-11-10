import { obtenerCatalogo } from "@/lib/api";
import { ProductCard } from "@/components/catalogo/ProductCard";
import { CategoryFilter } from "@/components/catalogo/CategoryFilter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catálogo Noble · Acacia Mates",
  description: "Explorá nuestra colección de mates de calabaza y madera, bombillas de alpaca y marroquinería en cuero curtido.",
};

export const revalidate = 30;

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria: catFiltro } = await searchParams;
  const todosLosProductos = await obtenerCatalogo();

  // Contabilizar categorías
  const mapaCategorias = new Map<string, { label: string; count: number }>();
  for (const p of todosLosProductos) {
    const slug = p.categoriaSlug || "general";
    const actual = mapaCategorias.get(slug) || { label: p.categoria, count: 0 };
    actual.count += 1;
    mapaCategorias.set(slug, actual);
  }

  const categorias = Array.from(mapaCategorias.entries()).map(([id, info]) => ({
    id,
    label: info.label,
    count: info.count,
  }));

  const productosFiltrados = catFiltro && catFiltro !== "todos"
    ? todosLosProductos.filter((p) => p.categoriaSlug === catFiltro)
    : todosLosProductos;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
      {/* Cabecera Editorial del Catálogo */}
      <div className="mb-8 space-y-3">
        <span className="font-mono-spec text-[10px] uppercase tracking-[0.3em] text-[#D9532F] block">
          [ ARCHIVO DE FORJA &amp; TALLER ]
        </span>
        <h1 className="font-editorial text-4xl sm:text-5xl text-[#1C1D1F]">
          Catálogo de Piezas Nobles
        </h1>
        <p className="text-xs sm:text-sm text-[#1C1D1F]/70 max-w-xl font-sans">
          Cada mate, bombilla y bolso ha sido confeccionado manualmente.
          Las variaciones de veta, tonalidad del cuero y textura son testimonio de su autenticidad artesanal.
        </p>
      </div>

      {/* Filtro de Categorías */}
      <CategoryFilter categorias={categorias} />

      {/* Grilla de Productos */}
      {productosFiltrados.length === 0 ? (
        <div className="py-24 text-center space-y-4">
          <span className="font-mono-spec text-xs uppercase tracking-widest text-[#6B6D69]">
            [ SIN RESULTADOS ]
          </span>
          <p className="font-editorial text-2xl text-[#1C1D1F]">
            No encontramos piezas en esta categoría en este momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-10">
          {productosFiltrados.map((prod) => (
            <ProductCard key={prod.id} producto={prod} />
          ))}
        </div>
      )}
    </div>
  );
}
