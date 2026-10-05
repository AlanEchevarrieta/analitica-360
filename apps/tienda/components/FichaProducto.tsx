"use client";

import { useState } from "react";
import { useCarrito } from "@/lib/carrito";
import { etiquetaVariante, finOferta, formatoARS, type ProductoTienda } from "@/lib/productos";
import { Precio } from "@/components/Precio";
import { BotonFavorito } from "@/lib/favoritos";
import { FotoProducto } from "@/components/ProductPlaceholder";
import { useSitio } from "@/lib/sitio-contexto";
import { urlWhatsApp } from "@/lib/whatsapp";

export function FichaProducto({ producto }: { producto: ProductoTienda }) {
  const { agregar } = useCarrito();
  const sitio = useSitio();
  const [foto, setFoto] = useState(0);
  const variantesActivas = producto.variantes.filter((v) => v.activo);
  const [varianteId, setVarianteId] = useState(variantesActivas[0]?.id ?? "");
  const [cantidad, setCantidad] = useState(1);

  const variante = variantesActivas.find((v) => v.id === varianteId);
  const precio = variante?.precio || producto.precio;
  const precioLista = variante?.precioLista || producto.precioLista;
  const stock = variante ? variante.stock : producto.stock;
  const sinStock = stock <= 0;

  const extra = variante ? ` (${etiquetaVariante(variante.atributos)})` : "";
  const consulta = `Hola! Quiero consultar por ${producto.nombre}${extra}.`;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <FotoProducto nombre={producto.nombre} url={producto.imagenes[foto]} large />
        {producto.imagenes.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto">
            {producto.imagenes.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setFoto(i)}
                aria-label={`Ver foto ${i + 1}`}
                className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 ${i === foto ? "border-[var(--marca)]" : "border-transparent"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={producto.miniaturas[i] ?? url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-serif text-3xl text-[var(--tinta)] sm:text-4xl">{producto.nombre}</h1>
          <BotonFavorito productoId={producto.id} nombre={producto.nombre} className="shrink-0 border border-[var(--marca-oscuro)]/15" />
        </div>
        <p className="mt-3 text-2xl font-semibold">
          <Precio precio={precio} precioLista={precioLista} />
        </p>
        {precioLista > precio && producto.ofertaHasta ? <p className="mt-1 text-sm text-[var(--tinta)]/60">Oferta {finOferta(producto.ofertaHasta)}</p> : null}
        {producto.categoria ? <p className="mt-2 text-sm text-[var(--tinta)]/60">{producto.categoria}</p> : null}
        <p className="mt-3 text-sm font-medium text-[var(--marca-hero)]">
          {sinStock ? "Sin stock" : `${stock} unidades disponibles`}
        </p>

        {variantesActivas.length > 0 ? (
          <label className="mt-5 block text-sm">
            Variante
            <select
              className="mt-1 w-full rounded-xl border border-[var(--marca-oscuro)]/20 bg-white px-3 py-2"
              value={varianteId}
              onChange={(e) => setVarianteId(e.target.value)}
            >
              {variantesActivas.map((v) => (
                <option key={v.id} value={v.id}>
                  {etiquetaVariante(v.atributos) || v.sku || "Variante"} — {formatoARS(v.precio)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="mt-5 flex items-center gap-3">
          <span className="text-sm">Cantidad</span>
          <button
            type="button"
            className="h-9 w-9 rounded-full border border-[var(--marca-oscuro)]/30"
            onClick={() => setCantidad((n) => Math.max(1, n - 1))}
          >
            −
          </button>
          <span className="w-8 text-center">{cantidad}</span>
          <button
            type="button"
            className="h-9 w-9 rounded-full border border-[var(--marca-oscuro)]/30"
            onClick={() => setCantidad((n) => n + 1)}
          >
            +
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={sinStock}
            onClick={() =>
              agregar(
                {
                  productoId: producto.id,
                  varianteId: variante?.id ?? null,
                  nombre: producto.nombre,
                  varianteEtiqueta: variante ? etiquetaVariante(variante.atributos) : "",
                  precio,
                  slug: producto.slug,
                },
                cantidad,
              )
            }
            className="rounded-[var(--r-boton)] bg-[var(--marca-oscuro)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--marca-hero)] disabled:cursor-not-allowed disabled:bg-[var(--marca-oscuro)]/40"
          >
            Agregar al carrito
          </button>
          {urlWhatsApp(sitio.whatsapp, consulta) ? (
            <a
              href={urlWhatsApp(sitio.whatsapp, consulta)!}
              target="_blank"
              rel="noreferrer"
              className="rounded-[var(--r-boton)] border border-[var(--marca-hero)] px-6 py-3 text-center text-sm font-semibold text-[var(--marca-hero)] hover:bg-[var(--marca-hero)] hover:text-white"
            >
              Consultar por WhatsApp
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
