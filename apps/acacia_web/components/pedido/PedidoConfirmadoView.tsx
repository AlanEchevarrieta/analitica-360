"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatoARS } from "@/lib/utils";
import { Check, Copy, MessageCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { SitioConfig } from "@/lib/types";

export function PedidoConfirmadoView({ config }: { config: SitioConfig }) {
  const searchParams = useSearchParams();
  const numero = searchParams.get("numero") || "#AC-0001";
  const total = Number(searchParams.get("total") || 0);
  const metodo = searchParams.get("metodo") || "transferencia";
  const cliente = searchParams.get("cliente") || "Cliente";
  const pagoUrl = searchParams.get("pagoUrl");

  const [copiadoAlias, setCopiadoAlias] = useState(false);
  const [copiadoCbu, setCopiadoCbu] = useState(false);

  const copiar = (texto: string, tipo: "alias" | "cbu") => {
    navigator.clipboard.writeText(texto);
    if (tipo === "alias") {
      setCopiadoAlias(true);
      setTimeout(() => setCopiadoAlias(false), 2000);
    } else {
      setCopiadoCbu(true);
      setTimeout(() => setCopiadoCbu(false), 2000);
    }
  };

  const whatsappMsg = encodeURIComponent(
    `¡Hola Acacia Mates! Acabo de confirmar el pedido ${numero} a nombre de ${cliente} por ${formatoARS(total)}. ¿Cómo seguimos con el despacho?`
  );
  const whatsappUrl = `https://wa.me/549${config.whatsapp}?text=${whatsappMsg}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center font-mono-spec">
      {/* Icono de Confirmación Noble */}
      <div className="size-16 bg-[#8A5A2B]/15 text-[#8A5A2B] rounded-full flex items-center justify-center mx-auto mb-6">
        <Check size={32} />
      </div>

      <span className="text-[10px] uppercase tracking-[0.3em] text-[#D9532F] block mb-2">
        [ PEDIDO REGISTRADO EN ANALÍTICA 360 ]
      </span>
      <h1 className="font-editorial text-4xl sm:text-5xl text-[#1C1D1F] mb-4">
        ¡Gracias por tu compra, {cliente}!
      </h1>
      <p className="text-xs sm:text-sm text-[#1C1D1F]/70 max-w-lg mx-auto font-sans leading-relaxed mb-8">
        Tu pedido ha sido recibido en nuestro taller. Cada pieza es inspeccionada y acondicionada antes de emprender su viaje.
      </p>

      {/* Recuadro de Resumen del Pedido */}
      <div className="bg-[#E5E5E1]/40 border border-[#1C1D1F]/15 p-8 text-left space-y-6 mb-10">
        <div className="flex justify-between items-baseline border-b border-[#1C1D1F]/10 pb-4">
          <span className="text-xs text-[#6B6D69]">Número de Orden:</span>
          <span className="text-lg font-bold text-[#1C1D1F]">{numero}</span>
        </div>
        <div className="flex justify-between items-baseline border-b border-[#1C1D1F]/10 pb-4">
          <span className="text-xs text-[#6B6D69]">Monto a Abonar:</span>
          <span className="text-xl font-bold text-[#8A5A2B]">{formatoARS(total)}</span>
        </div>

        {/* Datos Bancarios para Transferencia */}
        {metodo === "transferencia" && (
          <div className="pt-2 space-y-4">
            <span className="text-[11px] uppercase tracking-wider text-[#1C1D1F] font-bold block">
              Datos para la Transferencia Bancaria (10% OFF Aplicado):
            </span>

            <div className="bg-white p-4 border border-[#1C1D1F]/10 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[#6B6D69] block text-[10px]">ALIAS</span>
                  <span className="font-bold text-[#1C1D1F]">{config.alias}</span>
                </div>
                <button
                  onClick={() => copiar(config.alias || "", "alias")}
                  className="px-3 py-1.5 border border-[#1C1D1F]/20 text-[10px] uppercase hover:bg-[#1C1D1F]/5 flex items-center gap-1.5"
                >
                  {copiadoAlias ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  <span>{copiadoAlias ? "Copiado" : "Copiar"}</span>
                </button>
              </div>

              <div className="flex justify-between items-center border-t border-[#1C1D1F]/5 pt-2">
                <div>
                  <span className="text-[#6B6D69] block text-[10px]">CBU</span>
                  <span className="font-bold text-[#1C1D1F] text-[11px]">{config.cbu}</span>
                </div>
                <button
                  onClick={() => copiar(config.cbu || "", "cbu")}
                  className="px-3 py-1.5 border border-[#1C1D1F]/20 text-[10px] uppercase hover:bg-[#1C1D1F]/5 flex items-center gap-1.5"
                >
                  {copiadoCbu ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  <span>{copiadoCbu ? "Copiado" : "Copiar"}</span>
                </button>
              </div>

              <div className="border-t border-[#1C1D1F]/5 pt-2 text-[10px] text-[#6B6D69]">
                Titular: <strong>{config.titular}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Link de Mercado Pago si vino de la pasarela */}
        {pagoUrl && (
          <div className="pt-2">
            <a
              href={pagoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-4 bg-[#009EE3] text-white font-mono-spec text-xs uppercase tracking-widest hover:brightness-105"
            >
              Completar Pago en Mercado Pago &rarr;
            </a>
          </div>
        )}
      </div>

      {/* Botón WhatsApp */}
      <div className="space-y-4">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-8 py-4 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs uppercase tracking-[0.2em] transition-colors gap-3"
        >
          <MessageCircle size={18} />
          <span>Enviar Comprobante por WhatsApp</span>
        </a>

        <div className="pt-4">
          <Link
            href="/catalogo"
            className="inline-flex items-center text-xs text-[#6B6D69] hover:text-[#1C1D1F] uppercase tracking-widest gap-2"
          >
            <span>Regresar al inicio</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
