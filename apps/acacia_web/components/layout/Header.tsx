"use client";

import Link from "next/link";
import { useState } from "react";
import { useCarrito } from "@/lib/carrito";
import { ShoppingBag, Menu, X } from "lucide-react";

export function Header() {
  const { totalItems, abrir } = useCarrito();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#F7F6F2]/95 backdrop-blur-md border-b border-[#1C1D1F]/10">
      {/* Topbar Técnica Estilo Snow Peak */}
      <div className="bg-[#1C1D1F] text-[#E5E5E1] text-[10px] tracking-[0.2em] uppercase py-1.5 px-4 sm:px-8 flex justify-between items-center font-mono-spec">
        <span className="hidden sm:inline">
          [ 32°53&apos;S 68°51&apos;W · MENDOZA, ARG ]
        </span>
        <span className="mx-auto sm:mx-0 text-center">
          MANUFACTURA NOBLE &middot; ENVÍOS A TODO EL PAÍS
        </span>
        <span className="hidden md:inline">
          10% OFF POR TRANSFERENCIA
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-[#1C1D1F] focus:outline-none"
          aria-label="Menú principal"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Logo de Marca */}
        <Link href="/" className="flex flex-col items-center sm:items-start group">
          <span className="font-editorial text-2xl sm:text-3xl tracking-[0.25em] text-[#1C1D1F] group-hover:text-[#8A5A2B] transition-colors">
            ACACIA
          </span>
          <span className="text-[9px] font-mono-spec uppercase tracking-[0.3em] text-[#6B6D69] -mt-1">
            Mates &middot; Objetos Nobles
          </span>
        </Link>

        {/* Navegación Desktop Editorial */}
        <nav className="hidden md:flex items-center space-x-10 text-xs font-mono-spec uppercase tracking-[0.18em] text-[#1C1D1F]">
          <Link href="/catalogo" className="hover:text-[#8A5A2B] transition-colors">
            Catálogo
          </Link>
          <Link href="/el-ritual" className="hover:text-[#8A5A2B] transition-colors">
            El Ritual
          </Link>
          <Link href="/#materiales" className="hover:text-[#8A5A2B] transition-colors">
            Materiales
          </Link>
          <Link href="/#manifiesto" className="hover:text-[#8A5A2B] transition-colors">
            El Taller
          </Link>
        </nav>

        {/* Acceso a Bolsa / Carrito */}
        <button
          onClick={abrir}
          className="flex items-center space-x-3 text-xs font-mono-spec uppercase tracking-[0.15em] text-[#1C1D1F] hover:text-[#8A5A2B] transition-colors p-2"
          aria-label="Abrir carrito"
        >
          <span className="hidden sm:inline">Bolsa</span>
          <div className="relative">
            <ShoppingBag size={20} strokeWidth={1.5} />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-[#D9532F] text-white text-[9px] font-bold rounded-full size-4 flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Menú móvil desplegable */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#F7F6F2] border-b border-[#1C1D1F]/10 px-6 py-8 space-y-6 font-mono-spec text-sm uppercase tracking-[0.2em]">
          <Link
            href="/catalogo"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 border-b border-[#1C1D1F]/5"
          >
            Catálogo
          </Link>
          <Link
            href="/el-ritual"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 border-b border-[#1C1D1F]/5"
          >
            El Ritual
          </Link>
          <Link
            href="/#materiales"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 border-b border-[#1C1D1F]/5"
          >
            Materiales
          </Link>
          <Link
            href="/#manifiesto"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2"
          >
            El Taller
          </Link>
        </div>
      )}
    </header>
  );
}
