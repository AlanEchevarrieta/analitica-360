"use client";

import { useState } from "react";
import type { Producto } from "@/lib/types";
import { formatoARS } from "@/lib/utils";
import { useCarrito } from "@/lib/carrito";
import { SpecDrawer } from "./SpecDrawer";
import { ShoppingBag, Check } from "lucide-react";

export function ProductDetailView({ producto }: { producto: Producto }) {
  const { agregar } = useCarrito();
  const [varianteSeleccionada, setVarianteSeleccionada] = useState<string | null>(
    producto.variantes.length > 0 ? producto.variantes[0].id : null
  );
  const [cantidad, setCantidad] = useState(1);
  const [agregadoAnim, setAgregadoAnim] = useState(false);
  const [fotoActiva, setFotoActiva] = useState(0);

  const varianteActual = producto.variantes.find((v) => v.id === varianteSeleccionada);
  const precio = varianteActual ? varianteActual.precio : producto.precio;
  const precioLista = varianteActual ? varianteActual.precioLista : producto.precioLista;

  const handleAgregar = () => {
    agregar(
      {
        productoId: producto.id,
        varianteId: varianteActual ? varianteActual.id : null,
        nombre: producto.nombre,
        varianteEtiqueta: varianteActual ? Object.values(varianteActual.atributos).join(" · ") : undefined,
        precio,
        slug: producto.slug,
        imagen: producto.imagenes[fotoActiva] || producto.miniaturas[0],
      },
      cantidad
    );

    setAgregadoAnim(true);
    setTimeout(() => setAgregadoAnim(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
      {/* Columna Izquierda: Sticky Image Gallery (7 cols) */}
      <div className="lg:col-span-7 lg:sticky lg:top-28 space-y-4">
        <div className="relative aspect-[4/5] bg-[#1C1D1F]/5 overflow-hidden border border-[#1C1D1F]/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={producto.imagenes[fotoActiva] || producto.imagenes[0]}
            alt={producto.nombre}
            className="size-full object-cover transition-all duration-500"
          />
          {producto.descuentoPct > 0 && (
            <span className="absolute top-4 left-4 bg-[#D9532F] text-[#F7F6F2] font-mono-spec text-[10px] px-3 py-1 tracking-widest uppercase">
              {producto.descuentoPct}% OFF TRANSFERENCIA
            </span>
          )}
        </div>

        {/* Miniaturas */}
        {producto.imagenes.length > 1 && (
          <div className="flex gap-3">
            {producto.imagenes.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setFotoActiva(idx)}
                className={`relative size-20 border overflow-hidden transition-all ${
                  fotoActiva === idx ? "border-[#1C1D1F] ring-1 ring-[#1C1D1F]" : "border-[#1C1D1F]/10 opacity-70"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Columna Derecha: Detalles, Variantes y Compra (5 cols) */}
      <div className="lg:col-span-5 space-y-8">
        <div className="space-y-3">
          <span className="font-mono-spec text-[10px] uppercase tracking-[0.3em] text-[#D9532F] block">
            [ {producto.categoria} &middot; PIEZA DE AUTOR ]
          </span>
          <h1 className="font-editorial text-3xl sm:text-4xl text-[#1C1D1F] leading-tight">
            {producto.nombre}
          </h1>
          <div className="flex items-baseline space-x-3 font-mono-spec pt-1">
            <span className="text-2xl font-bold text-[#1C1D1F]">
              {formatoARS(precio)}
            </span>
            {producto.descuentoPct > 0 && (
              <span className="text-sm line-through text-[#6B6D69]">
                {formatoARS(precioLista)}
              </span>
            )}
            <span className="text-xs text-[#8A5A2B]">
              (10% off pagando por transferencia)
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#1C1D1F]/80 leading-relaxed font-sans">
          {producto.descripcion}
        </p>

        {/* Selector de Variantes */}
        {producto.variantes.length > 0 && (
          <div className="space-y-3 font-mono-spec text-xs">
            <span className="uppercase tracking-wider text-[#6B6D69] block">
              Variante / Terminación:
            </span>
            <div className="flex flex-wrap gap-2">
              {producto.variantes.map((v) => {
                const seleccionada = varianteSeleccionada === v.id;
                const etiqueta = Object.values(v.atributos).join(" - ");
                return (
                  <button
                    key={v.id}
                    onClick={() => setVarianteSeleccionada(v.id)}
                    className={`px-4 py-2 border uppercase tracking-wider text-[11px] transition-all ${
                      seleccionada
                        ? "bg-[#1C1D1F] text-[#F7F6F2] border-[#1C1D1F]"
                        : "border-[#1C1D1F]/20 text-[#1C1D1F] hover:border-[#1C1D1F]"
                    }`}
                  >
                    {etiqueta}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Cantidad y Botón Añadir a la Bolsa */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center border border-[#1C1D1F]/20 font-mono-spec text-xs">
              <button
                onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                className="px-3 py-3 hover:bg-[#1C1D1F]/5 text-[#1C1D1F]"
                aria-label="Disminuir"
              >
                -
              </button>
              <span className="px-4 py-3 min-w-10 text-center font-bold">
                {cantidad}
              </span>
              <button
                onClick={() => setCantidad(cantidad + 1)}
                className="px-3 py-3 hover:bg-[#1C1D1F]/5 text-[#1C1D1F]"
                aria-label="Aumentar"
              >
                +
              </button>
            </div>

            <button
              onClick={handleAgregar}
              className="flex-1 py-4 px-6 bg-[#1C1D1F] hover:bg-[#8A5A2B] text-[#F7F6F2] font-mono-spec text-xs uppercase tracking-[0.2em] flex items-center justify-center space-x-3 transition-colors shadow-sm"
            >
              {agregadoAnim ? (
                <>
                  <Check size={16} className="text-[#C5A059]" />
                  <span>Añadido a la Bolsa</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={16} />
                  <span>Añadir a la Bolsa &middot; {formatoARS(precio * cantidad)}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Layered Spec Drawer */}
        <SpecDrawer detalles={producto.detalles} />
      </div>
    </div>
  );
}
