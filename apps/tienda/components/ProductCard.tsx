"use client";

import Link from "next/link";
import { useCarrito } from "@/lib/carrito";
import { formatoARS, type ProductoTienda } from "@/lib/productos";
import { FotoProducto } from "@/components/ProductPlaceholder";

export function ProductCard({ producto }: { producto: ProductoTienda }) {
  const { agregar } = useCarrito();
  const sinStock = producto.stock <= 0;
  const variante = producto.variantes.find((v) => v.activo && v.stock > 0) ?? producto.variantes[0];
  const precio = variante?.precio || producto.precio;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white shadow-sm">
      <Link href={`/productos/${producto.slug}`} className="block">
        <FotoProducto nombre={producto.nombre} url={producto.imagenes[0]} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg leading-snug text-[var(--tinta)]">{producto.nombre}</h3>
          {sinStock ? (
            <span className="shrink-0 rounded-full bg-[var(--tinta)]/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--tinta)]/70">
              Sin stock
            </span>
          ) : null}
        </div>
        <p className="text-base font-semibold text-[var(--marca)]">{formatoARS(precio)}</p>
        <button
          type="button"
          disabled={sinStock}
          onClick={() =>
            agregar({
              productoId: producto.id,
              varianteId: variante?.id ?? null,
              nombre: producto.nombre,
              varianteEtiqueta: variante ? Object.values(variante.atributos).join(" / ") : "",
              precio,
              slug: producto.slug,
            })
          }
          className="mt-auto rounded-full bg-[var(--marca-oscuro)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--marca-hero)] disabled:cursor-not-allowed disabled:bg-[var(--marca-oscuro)]/40"
        >
          Agregar al carrito
        </button>
      </div>
    </article>
  );
}
