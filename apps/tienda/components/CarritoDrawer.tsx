"use client";

import Link from "next/link";
import { AvisoMinimo, useFaltaMinimo } from "@/components/AvisoMinimo";
import { useCarrito } from "@/lib/carrito";
import { formatoARS } from "@/lib/productos";

export function CarritoDrawer() {
  const { abierto, cerrar, items, total, setCantidad, quitar } = useCarrito();
  const falta = useFaltaMinimo(total);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50" aria-hidden={!abierto}>
      <button
        type="button"
        className={`absolute inset-0 bg-[var(--tinta)]/40 transition-opacity ${abierto ? "opacity-100" : "opacity-0"}`}
        onClick={cerrar}
        aria-label="Cerrar carrito"
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-[var(--crema)] shadow-2xl transition-transform duration-300 ${
          abierto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--marca-oscuro)]/15 px-5 py-4">
          <h2 className="font-serif text-xl text-[var(--tinta)]">Tu carrito</h2>
          <button type="button" onClick={cerrar} className="rounded-full p-2 hover:bg-[var(--marca-oscuro)]/10" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-[var(--tinta)]/70">Todavía no agregaste productos.</p>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={`${item.productoId}-${item.varianteId ?? "base"}`} className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-[var(--marca-hero)]/20" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--tinta)]">{item.nombre}</p>
                    {item.varianteEtiqueta ? (
                      <p className="text-xs text-[var(--tinta)]/60">{item.varianteEtiqueta}</p>
                    ) : null}
                    <p className="text-sm font-semibold text-[var(--marca)]">{formatoARS(item.precio)}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        className="h-7 w-7 rounded-full border border-[var(--marca-oscuro)]/30"
                        onClick={() => setCantidad(item.productoId, item.varianteId, item.cantidad - 1)}
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm">{item.cantidad}</span>
                      <button
                        type="button"
                        className="h-7 w-7 rounded-full border border-[var(--marca-oscuro)]/30"
                        onClick={() => setCantidad(item.productoId, item.varianteId, item.cantidad + 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="ml-auto text-xs text-[var(--marca)] underline"
                        onClick={() => quitar(item.productoId, item.varianteId)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-[var(--marca-oscuro)]/15 p-5">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span>Total</span>
            <span className="font-semibold text-[var(--marca-oscuro)]">{formatoARS(total)}</span>
          </div>
          <div className="mb-3">
            <AvisoMinimo total={total} />
          </div>
          <Link
            href="/checkout"
            onClick={cerrar}
            aria-disabled={items.length === 0 || falta > 0}
            className={`block rounded-[var(--r-boton)] bg-[var(--marca)] px-4 py-3 text-center text-sm font-semibold text-white ${
              items.length === 0 || falta > 0 ? "pointer-events-none opacity-50" : "hover:bg-[var(--marca-oscuro)]"
            }`}
          >
            Ir al checkout
          </Link>
        </div>
      </aside>
    </div>
  );
}
