"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Buscador, LupaIcon } from "@/components/Buscador";
import { useCarrito } from "@/lib/carrito";
import type { CategoriaTienda } from "@/lib/productos";
import { useSitio } from "@/lib/sitio-contexto";

const NAV = [
  { href: "/#sobre-nosotros", label: "Sobre nosotros" },
  { href: "/#contacto", label: "Contacto" },
];

export function Header({ categorias, conSesion }: { categorias: CategoriaTienda[]; conSesion: boolean }) {
  const { totalItems, abrir } = useCarrito();
  const sitio = useSitio();
  const [menu, setMenu] = useState(false);
  const [buscar, setBuscar] = useState(false);
  const [productos, setProductos] = useState(false);
  const pathname = usePathname();

  // Al cambiar de página se cierran el buscador y los menús.
  const [rutaAnterior, setRutaAnterior] = useState(pathname);
  if (rutaAnterior !== pathname) {
    setRutaAnterior(pathname);
    setBuscar(false);
    setProductos(false);
    setMenu(false);
  }

  const link = "text-sm font-medium text-[var(--tinta)]/80 transition hover:text-[var(--marca)]";
  const icono = "rounded-full p-2 text-[var(--marca-oscuro)] hover:bg-[var(--marca-oscuro)]/10";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--marca-oscuro)]/15 bg-[var(--crema)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-serif text-2xl tracking-tight text-[var(--marca-oscuro)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo del negocio, servido por la plataforma */}
          {sitio.logoUrl ? <img src={sitio.logoUrl} alt="" className="h-9 w-9 rounded-lg object-contain" /> : null}
          <span className="truncate">{sitio.nombre}</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className={link}>
            Inicio
          </Link>
          {/* Productos con sus categorías al pasar el mouse (o con Tab). */}
          <div className="relative" onMouseLeave={() => setProductos(false)}>
            <Link
              href="/productos"
              onMouseEnter={() => setProductos(true)}
              onFocus={() => setProductos(true)}
              aria-expanded={productos}
              aria-haspopup="true"
              className={link}
            >
              Productos ▾
            </Link>
            {productos && categorias.length > 0 ? (
              <div className="absolute -left-4 top-full pt-3">
                <ul className="w-64 overflow-hidden rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white py-2 shadow-lg">
                  {categorias.map((c) => (
                    <li key={c.id}>
                      <Link href={`/productos?cat=${c.id}`} className="flex items-baseline justify-between px-4 py-2 text-sm hover:bg-[var(--marca)]/10">
                        {c.label}
                        <span className="text-xs text-[var(--tinta)]/45">{c.cantidad}</span>
                      </Link>
                    </li>
                  ))}
                  <li className="mt-1 border-t border-[var(--marca-oscuro)]/10 pt-1">
                    <Link href="/productos" className="block px-4 py-2 text-sm font-medium text-[var(--marca)] hover:bg-[var(--marca)]/10">
                      Ver todos →
                    </Link>
                  </li>
                </ul>
              </div>
            ) : null}
          </div>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={link}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setBuscar((v) => !v);
              setMenu(false);
            }}
            className={icono}
            aria-label={buscar ? "Cerrar buscador" : "Buscar"}
            aria-expanded={buscar}
          >
            <LupaIcon />
          </button>
          <Link href={conSesion ? "/mi-cuenta" : "/ingresar"} className={icono} aria-label={conSesion ? "Mi cuenta" : "Ingresar"} title={conSesion ? "Mi cuenta" : "Ingresar"}>
            <PersonaIcon />
          </Link>
          <button type="button" onClick={abrir} className={`relative ${icono}`} aria-label={`Abrir carrito (${totalItems} productos)`}>
            <CartIcon />
            {totalItems > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--marca)] px-1 text-[11px] font-semibold text-white">
                {totalItems}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={`${icono} md:hidden`}
            onClick={() => {
              setMenu((v) => !v);
              setBuscar(false);
            }}
            aria-label="Abrir menú"
            aria-expanded={menu}
          >
            <MenuIcon open={menu} />
          </button>
        </div>
      </div>

      {buscar ? (
        <div className="border-t border-[var(--marca-oscuro)]/10 px-4 py-4">
          <div className="mx-auto max-w-2xl">
            <Buscador alCerrar={() => setBuscar(false)} />
          </div>
        </div>
      ) : null}

      {menu ? (
        <nav className="max-h-[70vh] space-y-1 overflow-y-auto border-t border-[var(--marca-oscuro)]/10 px-4 py-3 md:hidden">
          <Link href="/" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--marca-oscuro)]/10">
            Inicio
          </Link>
          <Link href="/productos" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--marca-oscuro)]/10">
            Todos los productos
          </Link>
          {categorias.map((c) => (
            <Link key={c.id} href={`/productos?cat=${c.id}`} className="flex justify-between rounded-lg py-2 pl-6 pr-3 text-sm text-[var(--tinta)]/80 hover:bg-[var(--marca-oscuro)]/10">
              {c.label}
              <span className="text-xs text-[var(--tinta)]/45">{c.cantidad}</span>
            </Link>
          ))}
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--marca-oscuro)]/10">
              {item.label}
            </Link>
          ))}
          <Link href={conSesion ? "/mi-cuenta" : "/ingresar"} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--marca-oscuro)]/10">
            {conSesion ? "Mi cuenta" : "Ingresar"}
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

function PersonaIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 20c1.2-3.6 4.1-5.4 7.5-5.4s6.3 1.8 7.5 5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6h15l-1.5 9h-12L6 6Zm0 0L5 3H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
