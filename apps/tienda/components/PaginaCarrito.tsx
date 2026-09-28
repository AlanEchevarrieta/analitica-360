"use client";

import { useCarrito } from "@/lib/carrito";
import { formatoARS } from "@/lib/productos";
import Link from "next/link";
import { AvisoMinimo, useFaltaMinimo } from "@/components/AvisoMinimo";

export function PaginaCarrito() {
  const { items, total, setCantidad, quitar } = useCarrito();
  const falta = useFaltaMinimo(total);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-serif text-3xl">Tu carrito está vacío</h1>
        <Link href="/productos" className="mt-6 inline-block rounded-[var(--r-boton)] bg-[var(--marca-oscuro)] px-6 py-3 text-sm font-semibold text-white">
          Ver colección
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl">Carrito</h1>
      <ul className="mt-6 space-y-4">
        {items.map((item) => (
          <li
            key={`${item.productoId}-${item.varianteId ?? "base"}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white p-4"
          >
            <div>
              <p className="font-medium">{item.nombre}</p>
              {item.varianteEtiqueta ? <p className="text-xs text-[var(--tinta)]/60">{item.varianteEtiqueta}</p> : null}
              <p className="text-sm text-[var(--marca)]">{formatoARS(item.precio)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 w-8 rounded-full border"
                onClick={() => setCantidad(item.productoId, item.varianteId, item.cantidad - 1)}
              >
                −
              </button>
              <span>{item.cantidad}</span>
              <button
                type="button"
                className="h-8 w-8 rounded-full border"
                onClick={() => setCantidad(item.productoId, item.varianteId, item.cantidad + 1)}
              >
                +
              </button>
              <button type="button" className="text-xs text-[var(--marca)]" onClick={() => quitar(item.productoId, item.varianteId)}>
                Quitar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Total {formatoARS(total)}</p>
          <AvisoMinimo total={total} />
        </div>
        <Link href="/checkout" aria-disabled={falta > 0} className={`rounded-[var(--r-boton)] bg-[var(--marca)] px-6 py-3 text-sm font-semibold text-white ${falta > 0 ? "pointer-events-none opacity-50" : ""}`}>
          Ir al checkout
        </Link>
      </div>
    </div>
  );
}
