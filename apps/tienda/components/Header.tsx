"use client";

import Link from "next/link";
import { useState } from "react";
import { useCarrito } from "@/lib/carrito";
import { useSitio } from "@/lib/sitio-contexto";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/#sobre-nosotros", label: "Sobre nosotros" },
  { href: "/#contacto", label: "Contacto" },
];

export function Header() {
  const { totalItems, abrir } = useCarrito();
  const sitio = useSitio();
  const [menu, setMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--marca-oscuro)]/15 bg-[var(--crema)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-serif text-2xl tracking-tight text-[var(--marca-oscuro)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo del negocio, servido por la plataforma */}
          {sitio.logoUrl ? <img src={sitio.logoUrl} alt="" className="h-9 w-9 rounded-lg object-contain" /> : null}
          <span className="truncate">{sitio.nombre}</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[var(--tinta)]/80 transition hover:text-[var(--marca)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={abrir}
            className="relative rounded-full p-2 text-[var(--marca-oscuro)] hover:bg-[var(--marca-oscuro)]/10"
            aria-label="Abrir carrito"
          >
            <CartIcon />
            {totalItems > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--marca)] px-1 text-[11px] font-semibold text-white">
                {totalItems}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-[var(--marca-oscuro)] md:hidden"
            onClick={() => setMenu((v) => !v)}
            aria-label="Abrir menú"
            aria-expanded={menu}
          >
            <MenuIcon open={menu} />
          </button>
        </div>
      </div>
      {menu ? (
        <nav className="space-y-1 border-t border-[var(--marca-oscuro)]/10 px-4 py-3 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenu(false)}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-[var(--tinta)] hover:bg-[var(--marca-oscuro)]/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6h15l-1.5 9h-12L6 6Zm0 0L5 3H2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="20" r="1.4" fill="currentColor" />
      <circle cx="18" cy="20" r="1.4" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
