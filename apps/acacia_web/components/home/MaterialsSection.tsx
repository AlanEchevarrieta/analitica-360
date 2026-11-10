export function MaterialsSection() {
  const materiales = [
    {
      codigo: "MAT-01",
      nombre: "Calabaza de Porongo",
      origen: "Brasil / Misiones",
      desc: "Frutos madurados al sol y seleccionados por su grosor de pared. Cada pieza es irrepetible en forma, veta y porosidad natural.",
      spec: "ESPESOR: 6–9 MM · AISLACIÓN NATURAL",
    },
    {
      codigo: "MAT-02",
      nombre: "Alpaca Maciza Cincelada",
      origen: "Orfebrería Argentina",
      desc: "Aleación noble de cobre, níquel y zinc forjada con cinceles de acero templado. Jamás se oxida y adquiere brillo plateado con el uso.",
      spec: "ESPESOR: 1.2 MM · SOLDADURA EN PLATA",
    },
    {
      codigo: "MAT-03",
      nombre: "Cuero Curtido Vegetal",
      origen: "Pampas Argentinas",
      desc: "Cuero vacuno pesado tratado con extractos de quebracho y castaño. Con los años de viajes y mateadas desarrolla una pátina tostada única.",
      spec: "CALIBRE: 2.5 MM · COSTURA A MANO",
    },
    {
      codigo: "MAT-04",
      nombre: "Algarrobo Estacionado",
      origen: "Monte Cuyano",
      desc: "Madera noble de altísima densidad secada al aire durante años. Su resina aromática atenúa naturalmente el amargor de la yerba.",
      spec: "DENSIDAD: 0.85 G/CM³ · CERA DE ABEJA",
    },
  ];

  return (
    <section id="materiales" className="py-24 px-4 sm:px-8 max-w-7xl mx-auto border-b border-[#1C1D1F]/10">
      <div className="space-y-4 mb-16">
        <span className="font-mono-spec text-[10px] uppercase tracking-[0.3em] text-[#D9532F] block">
          [ ANATOMÍA TÉCTIL ]
        </span>
        <h2 className="font-editorial text-3xl sm:text-5xl text-[#1C1D1F] tracking-tight">
          Materiales que Envejecen con Honor
        </h2>
        <p className="text-xs sm:text-sm text-[#1C1D1F]/70 max-w-2xl font-sans">
          Rechazamos los plásticos y los materiales efímeros. Cada objeto de Acacia está concebido para ser heredado.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {materiales.map((m) => (
          <div
            key={m.codigo}
            className="border border-[#1C1D1F]/15 p-6 bg-[#E5E5E1]/20 flex flex-col justify-between space-y-6 hover:border-[#8A5A2B] transition-colors"
          >
            <div>
              <div className="flex justify-between items-center font-mono-spec text-[10px] text-[#6B6D69] tracking-widest mb-3">
                <span>[ {m.codigo} ]</span>
                <span>{m.origen}</span>
              </div>
              <h3 className="font-editorial text-xl text-[#1C1D1F] mb-3">
                {m.nombre}
              </h3>
              <p className="text-xs text-[#1C1D1F]/70 leading-relaxed font-sans">
                {m.desc}
              </p>
            </div>

            <div className="border-t border-[#1C1D1F]/10 pt-3">
              <span className="font-mono-spec text-[9px] uppercase tracking-wider text-[#8A5A2B] block">
                {m.spec}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
