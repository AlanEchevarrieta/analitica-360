import Link from "next/link";
import type { Producto } from "@/lib/types";
import { formatoARS } from "@/lib/utils";

export function ProductCard({ producto }: { producto: Producto }) {
  return (
    <Link
      href={`/productos/${producto.slug}`}
      className="group flex flex-col justify-between bg-[#E5E5E1]/20 border border-[#1C1D1F]/10 hover:border-[#1C1D1F]/40 transition-all overflow-hidden"
    >
      {/* Contenedor de Imagen con Lifestyle Ratio */}
      <div className="relative aspect-[4/5] bg-[#1C1D1F]/5 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={producto.miniaturas[0] || producto.imagenes[0]}
          alt={producto.nombre}
          loading="lazy"
          className="size-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        {producto.descuentoPct > 0 && (
          <span className="absolute top-3 left-3 bg-[#D9532F] text-[#F7F6F2] font-mono-spec text-[9px] px-2 py-0.5 tracking-widest uppercase">
            {producto.descuentoPct}% OFF
          </span>
        )}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity font-mono-spec text-[9px] bg-[#1C1D1F]/80 text-white px-2 py-0.5 backdrop-blur-sm">
          DETALLES &rarr;
        </div>
      </div>

      {/* Información Editorial */}
      <div className="p-5 flex flex-col justify-between flex-1 space-y-3">
        <div>
          <span className="font-mono-spec text-[9px] uppercase tracking-[0.2em] text-[#6B6D69] block mb-1">
            [ {producto.categoria} ]
          </span>
          <h3 className="font-editorial text-lg sm:text-xl text-[#1C1D1F] group-hover:text-[#8A5A2B] transition-colors leading-snug">
            {producto.nombre}
          </h3>
        </div>

        <div className="flex justify-between items-baseline pt-2 border-t border-[#1C1D1F]/5 font-mono-spec">
          <div className="space-x-2">
            <span className="text-sm font-bold text-[#1C1D1F]">
              {formatoARS(producto.precio)}
            </span>
            {producto.descuentoPct > 0 && (
              <span className="text-[11px] line-through text-[#6B6D69]">
                {formatoARS(producto.precioLista)}
              </span>
            )}
          </div>
          <span className="text-[9px] text-[#6B6D69] uppercase tracking-wider">
            {producto.stock > 0 ? "DISPONIBLE" : "SIN STOCK"}
          </span>
        </div>
      </div>
    </Link>
  );
}
