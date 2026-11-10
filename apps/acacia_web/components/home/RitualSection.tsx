import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function RitualSection() {
  const pasos = [
    {
      num: "01",
      titulo: "La Temperatura Exacta",
      desc: "El agua a 75°C–80°C. Si hierve, quema la yerba y volatiliza sus aceites esenciales. La infusión debe acariciar el paladar, no agredirlo.",
    },
    {
      num: "02",
      titulo: "El Curado de 72 Horas",
      desc: "La calabaza respira. Se cura con yerba tibia usada durante tres días consecutivos, sellando su corteza y templando el alma del objeto.",
    },
    {
      num: "03",
      titulo: "La Montañita Inclinada",
      desc: "Sacudir el mate invertido, acomodar la yerba en 45 grados y cebar suavemente junto a la bombilla para preservar yerba seca para rondas posteriores.",
    },
  ];

  return (
    <section className="bg-[#2B302A] text-[#F7F6F2] py-24 px-4 sm:px-8 border-b border-white/10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Narrativa Izquierda */}
          <div className="lg:col-span-5 space-y-6">
            <span className="font-mono-spec text-[10px] uppercase tracking-[0.3em] text-[#C5A059] block">
              [ LA FILOSOFÍA DE LA PAUSA ]
            </span>
            <h2 className="font-editorial text-3xl sm:text-5xl text-[#F7F6F2] leading-tight">
              El Ritual del Mate &amp; El Fuego
            </h2>
            <p className="text-xs sm:text-sm text-[#E5E5E1]/80 leading-relaxed font-sans">
              En la cultura japonesa del outdoor (*Snow Peak*), cada elemento tiene un propósito y una ceremonia.
              En la tierra cuyana, el mate es nuestro fogón portátil: el hilo conductor que detiene la prisa y convoca a la conversación sincera.
            </p>
            <div className="pt-4">
              <Link
                href="/el-ritual"
                className="inline-flex items-center text-xs font-mono-spec uppercase tracking-[0.2em] text-[#C5A059] hover:text-white transition-colors"
              >
                <span>Leer la guía completa de curado</span>
                <ArrowRight size={14} className="ml-2" />
              </Link>
            </div>
          </div>

          {/* Pasos Técnicos Derecha */}
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-6">
            {pasos.map((paso) => (
              <div
                key={paso.num}
                className="bg-[#1C1D1F]/50 border border-white/10 p-6 flex flex-col justify-between space-y-4 hover:border-[#C5A059]/40 transition-colors"
              >
                <span className="font-mono-spec text-2xl text-[#C5A059] font-bold">
                  {paso.num}
                </span>
                <div>
                  <h3 className="font-editorial text-xl text-[#F7F6F2] mb-2">
                    {paso.titulo}
                  </h3>
                  <p className="text-xs text-[#E5E5E1]/70 leading-relaxed font-sans">
                    {paso.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
