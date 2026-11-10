import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[#1C1D1F] text-[#E5E5E1] pt-24 pb-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        {/* Manifiesto Editorial */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pb-16 border-b border-white/10">
          <div className="lg:col-span-6 space-y-6">
            <span className="font-mono-spec text-[10px] uppercase tracking-[0.3em] text-[#D9532F]">
              [ MANIFIESTO ACACIA ]
            </span>
            <p className="font-editorial text-2xl sm:text-3xl lg:text-4xl leading-snug tracking-wide text-[#F7F6F2]">
              &ldquo;La pausa del mate no es tiempo detenido. Es el ritual cotidiano donde los sentidos recobran su curso junto al fuego, la madera y el metal.&rdquo;
            </p>
            <p className="text-xs font-mono-spec text-[#A0A09B] tracking-wider leading-relaxed">
              Taller de diseño y forja criolla en Mendoza, Argentina. Fusionamos la pureza del Wabi-Sabi con las raíces y materiales de nuestra tierra.
            </p>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <span className="font-mono-spec text-[11px] uppercase tracking-[0.2em] text-[#A0A09B] block">
              Exploración
            </span>
            <ul className="space-y-2 text-xs font-mono-spec tracking-widest text-[#E5E5E1]">
              <li>
                <Link href="/catalogo" className="hover:text-[#C5A059] transition-colors">
                  &middot; Catálogo Noble
                </Link>
              </li>
              <li>
                <Link href="/el-ritual" className="hover:text-[#C5A059] transition-colors">
                  &middot; Guía de Curado
                </Link>
              </li>
              <li>
                <Link href="/#materiales" className="hover:text-[#C5A059] transition-colors">
                  &middot; Origen de Materiales
                </Link>
              </li>
              <li>
                <Link href="/#manifiesto" className="hover:text-[#C5A059] transition-colors">
                  &middot; Visitas al Taller
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <span className="font-mono-spec text-[11px] uppercase tracking-[0.2em] text-[#A0A09B] block">
              Contacto y Envíos
            </span>
            <div className="text-xs font-mono-spec text-[#E5E5E1] space-y-2 leading-relaxed">
              <p>Mendoza &middot; Argentina</p>
              <p className="text-[#A0A09B]">WhatsApp: +54 9 261 555-1234</p>
              <p className="text-[#A0A09B]">Instagram: @acaciamates</p>
              <p className="pt-2 text-[10px] text-[#A0A09B]">
                Envíos asegurados a todo el territorio argentino vía Andreani y Correo Argentino.
              </p>
            </div>
          </div>
        </div>

        {/* Subfooter Técnico */}
        <div className="pt-10 flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono-spec text-[#A0A09B] tracking-[0.2em] gap-4">
          <span>&copy; {new Date().getFullYear()} ACACIA MATES SRL &middot; TODOS LOS DERECHOS RESERVADOS</span>
          <span>ESTÉTICA SNOW PEAK &middot; POTENCIADO POR ANALÍTICA 360</span>
        </div>
      </div>
    </footer>
  );
}
