"use client";

import { CarritoProvider } from "@/lib/carrito";
import { SitioProvider } from "@/lib/sitio-contexto";
import type { Sitio } from "@/lib/sitio";
import { CarritoDrawer } from "@/components/CarritoDrawer";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { urlWhatsApp } from "@/lib/whatsapp";
import { FavoritosProvider } from "@/lib/favoritos";
import type { CategoriaTienda } from "@/lib/productos";

export function AppShell({
  sitio,
  categorias,
  conSesion,
  favoritos,
  children,
}: {
  sitio: Sitio;
  categorias: CategoriaTienda[];
  conSesion: boolean;
  favoritos: string[];
  children: React.ReactNode;
}) {
  return (
    <SitioProvider sitio={sitio}>
      <CarritoProvider>
        {/* La key lo reinicia cuando el servidor manda otra sesión o lista (ej. al ingresar): si no, quedaba la de antes. */}
        <FavoritosProvider key={`${conSesion}:${favoritos.join(",")}`} conSesion={conSesion} iniciales={favoritos}>
        {sitio.anuncio ? <p className="bg-[var(--marca-oscuro)] px-4 py-2 text-center text-sm font-medium text-white">{sitio.anuncio}</p> : null}
        <Header categorias={categorias} conSesion={conSesion} />
        <main className="flex-1">{children}</main>
        <Footer />
        <CarritoDrawer />
        <WhatsAppFlotante numero={sitio.whatsapp} nombre={sitio.nombre} />
        </FavoritosProvider>
      </CarritoProvider>
    </SitioProvider>
  );
}

/** Botón fijo para consultar por WhatsApp desde cualquier página. */
function WhatsAppFlotante({ numero, nombre }: { numero: string | null; nombre: string }) {
  const url = urlWhatsApp(numero, `Hola ${nombre}! Tengo una consulta.`);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="Consultar por WhatsApp"
      className="fixed bottom-5 right-5 z-30 flex size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25d366]"
    >
      <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden>
        <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5.1 5.2-1.4A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3a8.2 8.2 0 1 1 7 3.9Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
      </svg>
    </a>
  );
}
