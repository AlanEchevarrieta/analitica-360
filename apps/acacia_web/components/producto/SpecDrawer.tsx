"use client";

import { useState } from "react";
import type { ProductoDetalles } from "@/lib/types";
import { ChevronDown, ChevronUp } from "lucide-react";

export function SpecDrawer({ detalles }: { detalles: ProductoDetalles }) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({
    materiales: true,
    curado: true,
    envios: false,
  });

  const toggle = (key: string) => {
    setAbiertos((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="border-t border-[#1C1D1F]/15 font-mono-spec divide-y divide-[#1C1D1F]/10">
      {/* 01. Materiales y Origen */}
      <div>
        <button
          onClick={() => toggle("materiales")}
          className="w-full py-4 flex justify-between items-center text-xs uppercase tracking-wider text-[#1C1D1F] hover:text-[#8A5A2B] text-left"
        >
          <span>[ 01 &middot; MATERIALES &amp; FORJA ]</span>
          {abiertos.materiales ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {abiertos.materiales && (
          <div className="pb-4 text-xs text-[#1C1D1F]/80 space-y-2 leading-relaxed">
            <p>
              <strong className="text-[#1C1D1F]">Composición:</strong> {detalles.material}
            </p>
            {detalles.virola && (
              <p>
                <strong className="text-[#1C1D1F]">Virola:</strong> {detalles.virola}
              </p>
            )}
            <p>
              <strong className="text-[#1C1D1F]">Origen:</strong> {detalles.origen}
            </p>
            {detalles.pesoGramos && (
              <p>
                <strong className="text-[#1C1D1F]">Peso aprox.:</strong> {detalles.pesoGramos} gramos
              </p>
            )}
          </div>
        )}
      </div>

      {/* 02. Curado y Mantenimiento */}
      <div>
        <button
          onClick={() => toggle("curado")}
          className="w-full py-4 flex justify-between items-center text-xs uppercase tracking-wider text-[#1C1D1F] hover:text-[#8A5A2B] text-left"
        >
          <span>[ 02 &middot; GUÍA DE CURADO &amp; VIDA ÚTIL ]</span>
          {abiertos.curado ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {abiertos.curado && (
          <div className="pb-4 text-xs text-[#1C1D1F]/80 space-y-2 leading-relaxed font-sans">
            <p>{detalles.curado}</p>
            <p className="text-[11px] text-[#6B6D69] italic">
              Nunca lavar con detergentes agresivos ni dejar secar boca abajo sobre superficies húmedas.
            </p>
          </div>
        )}
      </div>

      {/* 03. Envíos y Garantía */}
      <div>
        <button
          onClick={() => toggle("envios")}
          className="w-full py-4 flex justify-between items-center text-xs uppercase tracking-wider text-[#1C1D1F] hover:text-[#8A5A2B] text-left"
        >
          <span>[ 03 &middot; ENVÍOS &amp; GARANTÍA ]</span>
          {abiertos.envios ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {abiertos.envios && (
          <div className="pb-4 text-xs text-[#1C1D1F]/80 space-y-2 leading-relaxed font-sans">
            <p>
              Despachamos desde Mendoza a todo el país por Correo Argentino y Andreani con seguro de rotura.
            </p>
            <p className="text-[#8A5A2B] font-bold">
              Garantía artesanal de por vida en soldaduras de virola y costuras en cuero.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
