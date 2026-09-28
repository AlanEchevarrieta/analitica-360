"use client";

import { CarritoProvider } from "@/lib/carrito";
import { SitioProvider } from "@/lib/sitio-contexto";
import type { Sitio } from "@/lib/sitio";
import { CarritoDrawer } from "@/components/CarritoDrawer";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export function AppShell({ sitio, children }: { sitio: Sitio; children: React.ReactNode }) {
  return (
    <SitioProvider sitio={sitio}>
      <CarritoProvider>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <CarritoDrawer />
      </CarritoProvider>
    </SitioProvider>
  );
}
