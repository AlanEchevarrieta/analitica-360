"use client";

import Link from "next/link";
import { useCarrito } from "@/lib/carrito";
import { formatoARS } from "@/lib/utils";
import { X, Trash2, ArrowRight, ShoppingBag } from "lucide-react";

export function CarritoDrawer() {
  const { items, abierto, cerrar, setCantidad, quitar, subtotal } = useCarrito();

  if (!abierto) return null;

  const descTransferencia = Math.round(subtotal * 0.1);
  const totalConDesc = subtotal - descTransferencia;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={cerrar}
        className="fixed inset-0 bg-[#1C1D1F]/50 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-[#F7F6F2] shadow-2xl h-full flex flex-col justify-between z-10 border-l border-[#1C1D1F]/15">
        {/* Header */}
        <div className="p-6 border-b border-[#1C1D1F]/10 flex justify-between items-center bg-[#F7F6F2]">
          <div className="flex items-center space-x-2">
            <ShoppingBag size={18} className="text-[#1C1D1F]" />
            <span className="font-editorial text-xl text-[#1C1D1F] tracking-wide">
              Bolsa de Compra
            </span>
          </div>
          <button
            onClick={cerrar}
            className="p-1.5 text-[#1C1D1F] hover:bg-[#1C1D1F]/10 transition-colors"
            aria-label="Cerrar bolsa"
          >
            <X size={20} />
          </button>
        </div>

        {/* Lista de Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <span className="font-mono-spec text-[10px] uppercase tracking-[0.2em] text-[#6B6D69]">
                [ BOLSA VACÍA ]
              </span>
              <p className="font-editorial text-2xl text-[#1C1D1F]">
                Tu selección aún no contiene piezas nobles.
              </p>
              <button
                onClick={cerrar}
                className="mt-2 text-xs font-mono-spec uppercase tracking-widest text-[#8A5A2B] hover:underline"
              >
                Volver al catálogo &rarr;
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={`${item.productoId}-${item.varianteId ?? "std"}`}
                className="flex gap-4 pb-6 border-b border-[#1C1D1F]/10 items-start"
              >
                <div className="size-20 shrink-0 bg-[#1C1D1F]/5 overflow-hidden border border-[#1C1D1F]/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imagen} alt={item.nombre} className="size-full object-cover" />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="font-editorial text-lg text-[#1C1D1F] truncate leading-tight">
                    {item.nombre}
                  </h4>
                  {item.varianteEtiqueta && (
                    <span className="text-[10px] font-mono-spec text-[#6B6D69] block">
                      {item.varianteEtiqueta}
                    </span>
                  )}
                  <div className="font-mono-spec text-xs font-bold text-[#1C1D1F]">
                    {formatoARS(item.precio)}
                  </div>

                  {/* Selector de cantidad */}
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex items-center border border-[#1C1D1F]/20 font-mono-spec text-[11px]">
                      <button
                        onClick={() => setCantidad(item.productoId, item.varianteId, item.cantidad - 1)}
                        className="px-2 py-0.5 hover:bg-[#1C1D1F]/10 text-[#1C1D1F]"
                      >
                        -
                      </button>
                      <span className="px-2.5 py-0.5 font-bold">{item.cantidad}</span>
                      <button
                        onClick={() => setCantidad(item.productoId, item.varianteId, item.cantidad + 1)}
                        className="px-2 py-0.5 hover:bg-[#1C1D1F]/10 text-[#1C1D1F]"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => quitar(item.productoId, item.varianteId)}
                      className="text-[#6B6D69] hover:text-[#D9532F] p-1 transition-colors"
                      aria-label="Quitar producto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer y Checkout */}
        {items.length > 0 && (
          <div className="p-6 border-t border-[#1C1D1F]/15 bg-[#E5E5E1]/30 space-y-4 font-mono-spec">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-[#6B6D69]">
                <span>Subtotal</span>
                <span>{formatoARS(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#8A5A2B] font-bold">
                <span>10% OFF Transferencia</span>
                <span>-{formatoARS(descTransferencia)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#1C1D1F] pt-2 border-t border-[#1C1D1F]/10">
                <span>Total Estimado</span>
                <span>{formatoARS(totalConDesc)}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              onClick={cerrar}
              className="w-full py-4 bg-[#1C1D1F] hover:bg-[#8A5A2B] text-[#F7F6F2] text-xs uppercase tracking-[0.2em] flex items-center justify-center space-x-2 transition-colors"
            >
              <span>Iniciar Pedido</span>
              <ArrowRight size={16} />
            </Link>

            <span className="text-[10px] text-center text-[#6B6D69] block">
              Envíos y medios de pago se eligen en el siguiente paso
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
