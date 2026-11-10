import Link from "next/link";
import type { Producto } from "@/lib/types";
import { formatoARS } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

export function FeaturedEditorial({ productos }: { productos: Producto[] }) {
  if (!productos || productos.length === 0) return null;

  const principal = productos[0];
  const secundarios = productos.slice(1, 4);

  return (
    <section className="py-24 px-4 sm:px-8 max-w-7xl mx-auto border-b border-[#1C1D1F]/10">
      {/* Encabezado Editorial */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
        <div>
          <span className="font-mono-spec text-[10px] uppercase tracking-[0.3em] text-[#D9532F] block mb-2">
            [ SELECCIÓN NOBLE ]
          </span>
          <h2 className="font-editorial text-3xl sm:text-5xl text-[#1C1D1F] tracking-tight">
            Piezas de Taller &amp; Forja
          </h2>
        </div>
        <Link
          href="/catalogo"
          className="inline-flex items-center text-xs font-mono-spec uppercase tracking-[0.2em] text-[#1C1D1F] hover:text-[#8A5A2B] transition-colors group"
        >
          <span>Ver catálogo completo ({productos.length})</span>
          <ArrowUpRight size={16} className="ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>

      {/* Grid Asimétrico Snow Peak */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Pieza Principal Destacada (7 cols) */}
        {principal && (
          <div className="lg:col-span-7 bg-[#E5E5E1]/40 border border-[#1C1D1F]/10 flex flex-col justify-between group overflow-hidden">
            <div className="p-8 sm:p-12 space-y-4">
              <div className="flex justify-between items-start font-mono-spec text-[10px] uppercase tracking-widest text-[#6B6D69]">
                <span>[ PIEZA INSIGNIA ]</span>
                <span className="text-[#D9532F]">STOCK DISPONIBLE</span>
              </div>
              <h3 className="font-editorial text-2xl sm:text-4xl text-[#1C1D1F]">
                {principal.nombre}
              </h3>
              <p className="text-xs sm:text-sm text-[#1C1D1F]/70 max-w-lg leading-relaxed">
                {principal.descripcion}
              </p>
              <div className="pt-2 flex items-center space-x-4">
                <span className="font-mono-spec text-lg font-bold text-[#1C1D1F]">
                  {formatoARS(principal.precio)}
                </span>
                {principal.descuentoPct > 0 && (
                  <span className="font-mono-spec text-xs line-through text-[#6B6D69]">
                    {formatoARS(principal.precioLista)}
                  </span>
                )}
              </div>
            </div>

            <Link href={`/productos/${principal.slug}`} className="relative aspect-[16/10] overflow-hidden block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={principal.imagenes[0]}
                alt={principal.nombre}
                className="size-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
            </Link>
          </div>
        )}

        {/* Columna de Piezas Secundarias (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-6">
          {secundarios.map((prod, idx) => (
            <Link
              key={prod.id}
              href={`/productos/${prod.slug}`}
              className="bg-[#E5E5E1]/30 border border-[#1C1D1F]/10 p-5 flex items-center gap-6 group hover:border-[#1C1D1F]/30 hover:bg-[#E5E5E1]/60 transition-all"
            >
              <div className="size-24 sm:size-28 shrink-0 overflow-hidden bg-[#1C1D1F]/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={prod.miniaturas[0] || prod.imagenes[0]}
                  alt={prod.nombre}
                  className="size-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="font-mono-spec text-[9px] uppercase tracking-widest text-[#6B6D69]">
                  [ 0{idx + 2} &middot; {prod.categoria} ]
                </div>
                <h4 className="font-editorial text-lg text-[#1C1D1F] truncate group-hover:text-[#8A5A2B] transition-colors">
                  {prod.nombre}
                </h4>
                <div className="font-mono-spec text-xs text-[#1C1D1F] font-bold">
                  {formatoARS(prod.precio)}
                </div>
              </div>

              <ArrowUpRight size={18} className="text-[#6B6D69] group-hover:text-[#1C1D1F] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
