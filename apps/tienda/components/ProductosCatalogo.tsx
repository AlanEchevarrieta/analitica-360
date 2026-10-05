import Link from "next/link";
import { ControlesCatalogo } from "@/components/ControlesCatalogo";
import { Migas } from "@/components/Migas";
import { Paginacion } from "@/components/Paginacion";
import { ProductCard } from "@/components/ProductCard";
import { resolverCatalogo, urlConsulta, type Consulta } from "@/lib/catalogo";
import type { CategoriaTienda, ProductoTienda } from "@/lib/productos";

/** Catálogo: categorías, búsqueda, filtros, orden y páginas, todo en la dirección (se puede compartir). */
export function ProductosCatalogo({ productos, categorias, consulta }: { productos: ProductoTienda[]; categorias: CategoriaTienda[]; consulta: Consulta }) {
  const { items, total, pagina, paginas, desde } = resolverCatalogo(productos, consulta);
  const categoria = categorias.find((c) => c.id === consulta.cat);
  const precios = productos.map((p) => p.precio);
  const bounds = { min: precios.length ? Math.floor(Math.min(...precios)) : 0, max: precios.length ? Math.ceil(Math.max(...precios)) : 0 };
  const titulo = consulta.q ? `“${consulta.q}”` : (categoria?.label ?? "Productos");
  const pasos = [
    { label: "Productos", href: "/productos" },
    ...(categoria ? [{ label: categoria.label, href: `/productos?cat=${categoria.id}` }] : []),
    ...(consulta.q ? [{ label: `Búsqueda: ${consulta.q}` }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Migas pasos={pasos} />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="break-words font-serif text-3xl text-[var(--tinta)] sm:text-4xl">{titulo}</h1>
          <p className="mt-1 text-sm text-[var(--tinta)]/60">
            {consulta.q ? (categoria ? `Resultados en ${categoria.label}` : "Resultados de búsqueda") : null}
            {consulta.q ? " · " : null}
            {total} {total === 1 ? "producto" : "productos"}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col flex-wrap gap-4 md:flex-row md:items-center md:justify-between">
        {/* Categorías: son links, así cada una tiene su propia dirección. */}
        <nav aria-label="Categorías" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {[{ id: "", label: "Todo", cantidad: productos.length }, ...categorias].map((c) => {
            const activo = consulta.cat === c.id;
            return (
              <Link
                key={c.id || "todo"}
                href={urlConsulta(consulta, { cat: c.id })}
                aria-current={activo ? "page" : undefined}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${
                  activo ? "border-[var(--marca-oscuro)] bg-[var(--marca-oscuro)] text-white" : "border-[var(--marca-oscuro)]/20 bg-white text-[var(--tinta)]/80 hover:border-[var(--marca)]"
                }`}
              >
                {c.label} <span className="opacity-60">{c.cantidad}</span>
              </Link>
            );
          })}
        </nav>
        <ControlesCatalogo key={urlConsulta(consulta)} consulta={consulta} bounds={bounds} />
      </div>

      {total === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--marca-oscuro)]/20 bg-white p-8 text-sm text-[var(--tinta)]/70">
          <p>
            {productos.length === 0
              ? "Estamos actualizando el catálogo. Volvé a pasar en un rato."
              : consulta.q
                ? `No encontramos productos para “${consulta.q}”.`
                : "No hay productos con esos filtros."}
          </p>
          {productos.length > 0 ? (
            <Link href="/productos" className="mt-3 inline-block font-medium text-[var(--marca)] underline">
              Ver todos los productos
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-[var(--tinta)]/55">
            Mostrando {desde + 1}–{desde + items.length} de {total}
          </p>
          <div className="grilla-productos mt-3 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
          <Paginacion consulta={consulta} pagina={pagina} paginas={paginas} />
        </>
      )}
    </div>
  );
}
