import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function HeroEditorial() {
  return (
    <section className="relative overflow-hidden bg-[#F7F6F2] border-b border-[#1C1D1F]/10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-8rem)]">
        {/* Columna Editorial de Texto (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between p-8 sm:p-12 lg:p-20 border-b lg:border-b-0 lg:border-r border-[#1C1D1F]/10">
          <div className="space-y-4">
            <span className="font-mono-spec text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#D9532F] block">
              [ COLECCIÓN 2026 &middot; FORJA CRIOLLA &amp; WABI-SABI ]
            </span>
            <h1 className="font-editorial text-4xl sm:text-6xl lg:text-7xl font-normal leading-[1.05] tracking-tight text-[#1C1D1F]">
              La nobleza del mate en su hábitat natural.
            </h1>
          </div>

          <div className="my-10 space-y-6 max-w-xl">
            <p className="text-sm sm:text-base text-[#1C1D1F]/80 leading-relaxed font-sans">
              No diseñamos recipientes aislados; concebimos objetos de comunión cotidiana.
              Calabaza brasilera curada a fuego lento, alpaca cincelada a mano y cuero curtido con taninos orgánicos.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2 font-mono-spec text-xs tracking-wider text-[#6B6D69]">
              <div>
                <span className="text-[#1C1D1F] block font-bold">01 / MATERIAL</span>
                Calabaza seleccionada de pared gruesa
              </div>
              <div>
                <span className="text-[#1C1D1F] block font-bold">02 / CORONA</span>
                Virola en alpaca maciza 1.2 mm
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link
              href="/catalogo"
              className="inline-flex items-center justify-center px-8 py-4 bg-[#1C1D1F] text-[#F7F6F2] text-xs font-mono-spec uppercase tracking-[0.2em] hover:bg-[#8A5A2B] transition-colors group"
            >
              <span>Explorar Catálogo</span>
              <ArrowRight size={16} className="ml-3 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/el-ritual"
              className="inline-flex items-center justify-center px-8 py-4 border border-[#1C1D1F]/30 text-[#1C1D1F] text-xs font-mono-spec uppercase tracking-[0.2em] hover:border-[#1C1D1F] hover:bg-[#1C1D1F]/5 transition-colors"
            >
              El Ritual del Curado
            </Link>
          </div>
        </div>

        {/* Columna Visual Inmersiva (5 cols) */}
        <div className="lg:col-span-5 relative min-h-[380px] lg:min-h-full bg-[#1C1D1F] overflow-hidden group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1400&q=85"
            alt="Mate Imperial Acacia en campamento cordillerano"
            className="absolute inset-0 size-full object-cover object-center group-hover:scale-105 transition-transform duration-700 opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1C1D1F]/80 via-transparent to-transparent" />
          
          <div className="absolute bottom-6 left-6 right-6 text-[#E5E5E1] font-mono-spec text-[10px] tracking-[0.2em] uppercase flex justify-between items-end">
            <div>
              <span className="block text-[#D9532F]">[ FIG. 01 ]</span>
              <span>MATE IMPERIAL &middot; AMANECER CORDILLERANO</span>
            </div>
            <span className="border border-white/20 px-2 py-1 backdrop-blur-sm">
              380G &middot; ALPACA
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
