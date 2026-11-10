import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "El Ritual del Mate · Acacia Mates",
  description: "Guía editorial sobre la ceremonia de la pausa, el curado tradicional de 72 horas y la maestría del cebado.",
};

export default function ElRitualPage() {
  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-8 py-20 font-sans space-y-16">
      {/* Portada Editorial */}
      <header className="space-y-6 text-center">
        <span className="font-mono-spec text-[10px] uppercase tracking-[0.3em] text-[#D9532F]">
          [ BITÁCORA DEL TALLER &middot; VOL. 01 ]
        </span>
        <h1 className="font-editorial text-4xl sm:text-6xl text-[#1C1D1F] leading-tight">
          El Arte de la Pausa &amp; El Ritual del Mate
        </h1>
        <p className="text-sm sm:text-base text-[#1C1D1F]/70 max-w-2xl mx-auto leading-relaxed">
          En un mundo acelerado por la inmediatez, cebar un mate es un acto de resistencia serena.
          Cada paso, desde el curado de la calabaza hasta la temperatura del agua, exige presencia y respeto por la materia prima.
        </p>
      </header>

      {/* Imagen Inmersiva */}
      <div className="relative aspect-[16/9] overflow-hidden bg-[#1C1D1F]/5 border border-[#1C1D1F]/15">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=1400&q=85"
          alt="Preparación del mate en fogón al amanecer"
          className="size-full object-cover"
        />
        <div className="absolute bottom-4 left-4 font-mono-spec text-[9px] uppercase tracking-widest text-white/90 bg-black/40 px-3 py-1 backdrop-blur-xs">
          FOGÓN DE MONTAÑA &middot; AGUA TEMPLADA A 78°C
        </div>
      </div>

      {/* Sección 01: El Curado */}
      <section className="space-y-6 border-t border-[#1C1D1F]/10 pt-12">
        <span className="font-mono-spec text-xs uppercase tracking-widest text-[#8A5A2B] block">
          01 &middot; EL TEMPLADO Y CURADO DE 72 HORAS
        </span>
        <h2 className="font-editorial text-3xl text-[#1C1D1F]">
          La Calabaza es un Objeto Vivo
        </h2>
        <div className="text-sm text-[#1C1D1F]/80 space-y-4 leading-relaxed">
          <p>
            Al recibir tu mate imperial de calabaza brasilera, notarás en su interior filamentos secos y un color claro natural.
            Antes de su primera cebada oficial, es indispensable sellar los poros para evitar filtraciones y amargores ásperos.
          </p>
          <div className="bg-[#E5E5E1]/40 border-l-2 border-[#8A5A2B] p-6 space-y-3 font-mono-spec text-xs">
            <h3 className="font-bold uppercase tracking-wider text-[#1C1D1F]">
              Instrucciones de Curado Tradicional:
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-[#1C1D1F]/80">
              <li>Llená el mate con yerba usada tibia (humedecida previamente con agua tibia).</li>
              <li>Agregá un chorrito de agua caliente (75°C) hasta el cuello del mate sin desbordar la virola.</li>
              <li>Dejalo reposar 24 horas en un lugar seco y ventilado.</li>
              <li>Vaciá el mate y, con una cuchara de postre, raspá suavemente las paredes internas para retirar el hollejo desprendido.</li>
              <li>Repetí el procedimiento durante 3 días seguidos. Al tercer día, tu mate tendrá un tono verde oliva profundo y estará listo.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Sección 02: La Geometría del Cebado */}
      <section className="space-y-6 border-t border-[#1C1D1F]/10 pt-12">
        <span className="font-mono-spec text-xs uppercase tracking-widest text-[#8A5A2B] block">
          02 &middot; LA GEOMETRÍA DEL CEBADO
        </span>
        <h2 className="font-editorial text-3xl text-[#1C1D1F]">
          La Montañita Inclinada y la Inserción de la Bombilla
        </h2>
        <div className="text-sm text-[#1C1D1F]/80 space-y-4 leading-relaxed">
          <p>
            Llená el mate hasta tres cuartas partes de su capacidad. Tapá la boca con la palma de la mano, invertilo y sacudilo enérgicamente para que el polvillo fino suba a la superficie y no bloquee el filtro de la bombilla.
          </p>
          <p>
            Acomodá la yerba en un plano inclinado de 45 grados. Verté un sorbo de agua tibia en el hueco inferior y dejá que se hidrate durante 60 segundos. Luego, tapando el pico de la bombilla con el pulgar para evitar el ingreso de aire, clavala suavemente hasta tocar el fondo de calabaza. Nunca muevas la bombilla una vez colocada.
          </p>
        </div>
      </section>

      {/* Cierre Editorial */}
      <div className="border-t border-[#1C1D1F]/10 pt-12 text-center space-y-6">
        <p className="font-editorial text-2xl text-[#1C1D1F] italic">
          &ldquo;Un buen mate no se apresura. Se espera como se espera el calor de las brasas al caer la tarde.&rdquo;
        </p>
        <div>
          <Link
            href="/catalogo"
            className="inline-flex items-center px-8 py-4 bg-[#1C1D1F] hover:bg-[#8A5A2B] text-[#F7F6F2] font-mono-spec text-xs uppercase tracking-widest transition-colors gap-3"
          >
            <span>Ver Colección de Mates</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}
