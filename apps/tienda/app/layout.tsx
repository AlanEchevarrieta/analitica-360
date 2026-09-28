import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { TiendaNoEncontrada } from "@/components/TiendaNoEncontrada";
import { obtenerSitio } from "@/lib/sitio";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export async function generateMetadata(): Promise<Metadata> {
  const sitio = await obtenerSitio();
  if (!sitio) return { title: "Tienda no encontrada" };
  return {
    title: { default: sitio.descripcion ? `${sitio.nombre} — ${sitio.descripcion}` : sitio.nombre, template: `%s — ${sitio.nombre}` },
    description: sitio.descripcion ?? `Tienda online de ${sitio.nombre}`,
    icons: sitio.logoUrl ? { icon: sitio.logoUrl } : undefined,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sitio = await obtenerSitio();
  return (
    <html
      lang="es-AR"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
      // El color de marca del negocio: de él salen todos los colores de la tienda (globals.css).
      style={sitio ? ({ "--marca": sitio.color } as React.CSSProperties) : undefined}
    >
      <body className="flex min-h-full flex-col font-sans">{sitio ? <AppShell sitio={sitio}>{children}</AppShell> : <TiendaNoEncontrada />}</body>
    </html>
  );
}
